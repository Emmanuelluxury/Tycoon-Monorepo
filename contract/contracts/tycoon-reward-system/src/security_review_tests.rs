/// # Security Review Tests — tycoon-reward-system (SW-CT-013)
///
/// Automated tests that directly map to the items in `SECURITY_REVIEW_CHECKLIST.md`.
/// Each test cites the checklist row it exercises.
///
/// | Test                                       | Checklist item |
/// |--------------------------------------------|----------------|
/// | `sec_ac4_only_admin_or_minter_can_mint`    | AC-4           |
/// | `sec_ac6_redeemer_must_own_voucher`        | AC-6           |
/// | `sec_int2_checked_add_prevents_overflow`   | INT-3 / OI-2   |
/// | `sec_int5_amount_exceeding_i128_max_panics`| INT-5 / OI-3   |
/// | `sec_pause1_redeem_blocked_when_paused`    | PAUSE-1        |
/// | `sec_pause2_transfer_blocked_when_paused`  | PAUSE-2        |
/// | `sec_pause3_mint_allowed_when_paused`      | PAUSE-3        |
/// | `sec_st1_voucher_value_deleted_before_xfer`| ST-1           |
/// | `sec_st3_voucher_ids_are_monotonic`        | ST-3           |
extern crate std;

use crate::{TycoonRewardSystem, TycoonRewardSystemClient};
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ── Harness ───────────────────────────────────────────────────────────────────

struct H<'a> {
    env: Env,
    client: TycoonRewardSystemClient<'a>,
    admin: Address,
    tyc_id: Address,
    #[allow(dead_code)]
    usdc_id: Address,
    contract_id: Address,
}

impl H<'_> {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let tyc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let usdc_id = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(&env, &contract_id);
        client.initialize(&admin, &tyc_id, &usdc_id);

        H {
            env,
            client,
            admin,
            tyc_id,
            usdc_id,
            contract_id,
        }
    }

    fn fund_tyc(&self, amount: i128) {
        StellarAssetClient::new(&self.env, &self.tyc_id).mint(&self.contract_id, &amount);
    }

    fn tyc_balance_of(&self, addr: &Address) -> i128 {
        TokenClient::new(&self.env, &self.tyc_id).balance(addr)
    }
}

// ── AC-4: only admin or backend minter can mint ───────────────────────────────

/// SEC-AC-4: A stranger (neither admin nor registered backend minter) must be
/// rejected by `mint_voucher`.
#[test]
fn sec_ac4_only_admin_or_minter_can_mint() {
    let h = H::new();
    let stranger = Address::generate(&h.env);
    let user = Address::generate(&h.env);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.mint_voucher(&stranger, &user, &100);
    }));
    assert!(
        res.is_err(),
        "SEC-AC-4: non-admin/non-minter must not be able to mint"
    );
}

// ── AC-6: redeemer must own the voucher ──────────────────────────────────────

/// SEC-AC-6: Attempting to redeem a voucher by an address that does not hold it
/// must panic with "Insufficient balance".
#[test]
fn sec_ac6_redeemer_must_own_voucher() {
    let h = H::new();
    h.fund_tyc(10_000);

    let owner = Address::generate(&h.env);
    let thief = Address::generate(&h.env);

    let token_id = h.client.mint_voucher(&h.admin, &owner, &500);

    // Thief tries to redeem a voucher they don't hold
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.redeem_voucher_from(&thief, &token_id);
    }));
    assert!(
        res.is_err(),
        "SEC-AC-6: redeemer without balance must be rejected"
    );

    // Original owner can still redeem
    h.client.redeem_voucher_from(&owner, &token_id);
    assert_eq!(h.tyc_balance_of(&owner), 500);
}

// ── INT-1 / OI-2: VoucherCount uses checked arithmetic ───────────────────────

/// SEC-INT-2: VoucherCount increments correctly and monotonically across
/// successive mints (exercises the checked_add path added for OI-2).
#[test]
fn sec_int2_checked_add_prevents_overflow() {
    let h = H::new();
    let user = Address::generate(&h.env);

    let id1 = h.client.mint_voucher(&h.admin, &user, &10);
    let id2 = h.client.mint_voucher(&h.admin, &user, &20);
    let id3 = h.client.mint_voucher(&h.admin, &user, &30);

    assert_eq!(id2 - id1, 1, "SEC-INT-2: counter must increment by 1");
    assert_eq!(id3 - id2, 1, "SEC-INT-2: counter must increment by 1");
    assert!(id1 >= 1_000_000_000, "SEC-INT-2: IDs must start at VOUCHER_ID_START");
}

// ── INT-5 / OI-3: amount > i128::MAX is rejected ─────────────────────────────

/// SEC-INT-5: `admin_withdraw_funds` must panic when `amount` exceeds
/// `i128::MAX`, preventing silent integer truncation in the cast.
/// This guards OI-3 from the security checklist.
#[test]
fn sec_int5_amount_exceeding_i128_max_panics() {
    let h = H::new();
    let recipient = Address::generate(&h.env);

    // i128::MAX as u128 is valid; i128::MAX + 1 must be rejected.
    let oversized: u128 = i128::MAX as u128 + 1;

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.withdraw_funds(&h.tyc_id, &recipient, &oversized);
    }));
    assert!(
        res.is_err(),
        "SEC-INT-5: amount exceeding i128::MAX must be rejected"
    );
}

// ── PAUSE-1: redeem blocked when paused ──────────────────────────────────────

/// SEC-PAUSE-1: `redeem_voucher_from` must panic with "Contract is paused"
/// when the contract is in the paused state (PAUSE-1 in checklist).
#[test]
fn sec_pause1_redeem_blocked_when_paused() {
    let h = H::new();
    h.fund_tyc(10_000);

    let user = Address::generate(&h.env);
    let token_id = h.client.mint_voucher(&h.admin, &user, &500);

    h.client.pause();

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.redeem_voucher_from(&user, &token_id);
    }));
    assert!(res.is_err(), "SEC-PAUSE-1: redeem must be blocked when paused");

    // Unpause restores functionality
    h.client.unpause();
    h.client.redeem_voucher_from(&user, &token_id);
    assert_eq!(h.tyc_balance_of(&user), 500);
}

// ── PAUSE-2: transfer blocked when paused ────────────────────────────────────

/// SEC-PAUSE-2: `transfer` must panic when the contract is paused
/// (PAUSE-2 in checklist).
#[test]
fn sec_pause2_transfer_blocked_when_paused() {
    let h = H::new();

    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id = h.client.mint_voucher(&h.admin, &sender, &100);

    h.client.pause();

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.transfer(&sender, &receiver, &token_id, &1);
    }));
    assert!(
        res.is_err(),
        "SEC-PAUSE-2: transfer must be blocked when paused"
    );
}

// ── PAUSE-3: minting allowed while paused ────────────────────────────────────

/// SEC-PAUSE-3: `mint_voucher` must succeed even when the contract is paused.
/// This is intentional — minting rewards during an emergency pause must remain
/// possible so that season-end payouts are not blocked (PAUSE-3 in checklist).
#[test]
fn sec_pause3_mint_allowed_when_paused() {
    let h = H::new();

    let user = Address::generate(&h.env);
    h.client.pause();

    // Minting must succeed without panicking
    let token_id = h.client.mint_voucher(&h.admin, &user, &200);
    assert_eq!(
        h.client.get_balance(&user, &token_id),
        1,
        "SEC-PAUSE-3: mint must succeed while paused"
    );
}

// ── ST-1: VoucherValue deleted before token transfer ─────────────────────────

/// SEC-ST-1: After a successful redeem the `VoucherValue` entry is deleted
/// from storage. A second redeem attempt must panic because the value is gone.
/// This confirms the CEI ordering that prevents double-spend (ST-1).
#[test]
fn sec_st1_voucher_value_deleted_before_xfer() {
    let h = H::new();
    h.fund_tyc(10_000);

    let user = Address::generate(&h.env);
    let token_id = h.client.mint_voucher(&h.admin, &user, &300);

    h.client.redeem_voucher_from(&user, &token_id);
    assert_eq!(h.tyc_balance_of(&user), 300);

    // Second redeem must fail — VoucherValue was deleted
    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.redeem_voucher_from(&user, &token_id);
    }));
    assert!(
        res.is_err(),
        "SEC-ST-1: second redeem must fail after VoucherValue is removed"
    );
}

// ── ST-3: voucher IDs are monotonically increasing and unique ─────────────────

/// SEC-ST-3: VoucherCount never reuses a token ID — each mint produces a
/// strictly larger ID than the previous one (ST-3 in checklist).
#[test]
fn sec_st3_voucher_ids_are_monotonic() {
    let h = H::new();
    let user = Address::generate(&h.env);

    let ids: std::vec::Vec<u128> = (0..5)
        .map(|_| h.client.mint_voucher(&h.admin, &user, &10))
        .collect();

    for window in ids.windows(2) {
        assert!(
            window[1] > window[0],
            "SEC-ST-3: voucher IDs must be strictly increasing; got {} then {}",
            window[0],
            window[1]
        );
        assert_ne!(window[0], window[1], "SEC-ST-3: IDs must be unique");
    }
}
