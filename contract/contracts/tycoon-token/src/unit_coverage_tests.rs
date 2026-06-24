/// # Tycoon Token — Additional Unit & Integration Coverage (SW-CT-002)
///
/// Covers gaps not exercised by the existing test modules:
///
/// | Area | Tests |
/// |------|-------|
/// | `transfer_from` expiry edge cases | at-boundary, at-expiry, one-past |
/// | `approve` boundary: re-approve increases/decreases allowance | `approve_*` |
/// | `approve` with future `expiration_ledger` | `approve_future_expiry_*` |
/// | `transfer_from` partial spend + re-spend sequence | `transfer_from_partial_*` |
/// | `burn_from` at-expiry boundary | `burn_from_expiry_*` |
/// | Integration: mint → approve → transfer_from → burn_from chain | `integration_*` |
/// | Integration: sequential approvals overwrite, not accumulate | `integration_approve_overwrite` |
/// | Edge: transfer to self is a no-op | `transfer_to_self_*` |
/// | Edge: transfer_from where spender == from | `transfer_from_spender_is_from` |
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Env,
};

const SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000;
const TYC: i128 = 1_000_000_000_000_000_000; // 1 TYC (18 decimals)

fn setup() -> (Env, TycoonTokenClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);
    (e, client, admin)
}

fn set_seq(e: &Env, seq: u32) {
    e.ledger().set(LedgerInfo {
        sequence_number: seq,
        timestamp: seq as u64 * 5,
        protocol_version: 23,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });
}

// ── transfer_from expiry edge cases ──────────────────────────────────────────

/// Allowance with `expiration_ledger = N` is still valid at sequence N (inclusive).
#[test]
fn transfer_from_expiry_at_boundary_succeeds() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let expiry: u32 = 100;
    client.approve(&admin, &spender, &(10 * TYC), &expiry);

    set_seq(&e, expiry); // exactly at expiry — still valid
    client.transfer_from(&spender, &admin, &recipient, &TYC);
    assert_eq!(client.balance(&recipient), TYC);
}

/// Allowance expires at sequence N+1 (one past `expiration_ledger`).
#[test]
#[should_panic(expected = "Allowance expired")]
fn transfer_from_expiry_one_past_boundary_rejected() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let expiry: u32 = 100;
    client.approve(&admin, &spender, &(10 * TYC), &expiry);

    set_seq(&e, expiry + 1);
    client.transfer_from(&spender, &admin, &recipient, &TYC);
}

/// `allowance()` returns `0` at expiry + 1 even though the record still exists in storage.
#[test]
fn transfer_from_allowance_read_zero_after_expiry() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    client.approve(&admin, &spender, &(5 * TYC), &50);
    set_seq(&e, 51);
    assert_eq!(client.allowance(&admin, &spender), 0);
}

// ── burn_from expiry edge cases ───────────────────────────────────────────────

/// `burn_from` at exactly `expiration_ledger` still succeeds.
#[test]
fn burn_from_expiry_at_boundary_succeeds() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    let expiry: u32 = 200;
    client.approve(&admin, &spender, &(20 * TYC), &expiry);

    set_seq(&e, expiry);
    client.burn_from(&spender, &admin, &TYC);
    assert_eq!(client.total_supply(), SUPPLY - TYC);
}

/// `burn_from` one past `expiration_ledger` is rejected.
#[test]
#[should_panic(expected = "Allowance expired")]
fn burn_from_expiry_one_past_boundary_rejected() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    client.approve(&admin, &spender, &(20 * TYC), &200);
    set_seq(&e, 201);
    client.burn_from(&spender, &admin, &TYC);
}

// ── approve boundary: re-approve overwrites, does not accumulate ──────────────

/// Re-approving with a larger amount replaces the old allowance.
#[test]
fn approve_boundary_increase_overwrites() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    client.approve(&admin, &spender, &(10 * TYC), &0);
    assert_eq!(client.allowance(&admin, &spender), 10 * TYC);

    client.approve(&admin, &spender, &(25 * TYC), &0);
    assert_eq!(
        client.allowance(&admin, &spender),
        25 * TYC,
        "re-approve should overwrite, not add"
    );
}

/// Re-approving with a smaller amount replaces the old allowance.
#[test]
fn approve_boundary_decrease_overwrites() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    client.approve(&admin, &spender, &(50 * TYC), &0);
    client.approve(&admin, &spender, &(5 * TYC), &0);
    assert_eq!(client.allowance(&admin, &spender), 5 * TYC);
}

/// Approving the same amount twice leaves allowance equal to that amount.
#[test]
fn approve_boundary_idempotent() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    client.approve(&admin, &spender, &(10 * TYC), &0);
    client.approve(&admin, &spender, &(10 * TYC), &0);
    assert_eq!(client.allowance(&admin, &spender), 10 * TYC);
}

/// Approving with a future expiry that was previously expired resets the allowance.
#[test]
fn approve_future_expiry_resets_expired_allowance() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    // First approval, expires at ledger 10
    client.approve(&admin, &spender, &(10 * TYC), &10);
    set_seq(&e, 11); // now expired
    assert_eq!(client.allowance(&admin, &spender), 0);

    // Re-approve with new expiry
    client.approve(&admin, &spender, &(5 * TYC), &500);
    assert_eq!(client.allowance(&admin, &spender), 5 * TYC);

    // Spend works again
    client.transfer_from(&spender, &admin, &recipient, &TYC);
    assert_eq!(client.balance(&recipient), TYC);
}

// ── transfer_from partial spend sequences ────────────────────────────────────

/// Two partial `transfer_from` calls consume the allowance incrementally.
#[test]
fn transfer_from_partial_two_spends_consume_allowance() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.approve(&admin, &spender, &(10 * TYC), &0);

    client.transfer_from(&spender, &admin, &recipient, &(3 * TYC));
    assert_eq!(client.allowance(&admin, &spender), 7 * TYC);

    client.transfer_from(&spender, &admin, &recipient, &(7 * TYC));
    assert_eq!(client.allowance(&admin, &spender), 0);
    assert_eq!(client.balance(&recipient), 10 * TYC);
}

/// After exhausting the allowance, a further `transfer_from` fails.
#[test]
#[should_panic(expected = "Insufficient allowance")]
fn transfer_from_partial_exhausted_allowance_rejected() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.approve(&admin, &spender, &(5 * TYC), &0);
    client.transfer_from(&spender, &admin, &recipient, &(5 * TYC));
    // Allowance is now 0 — this must fail
    client.transfer_from(&spender, &admin, &recipient, &TYC);
}

// ── edge: transfer to self ────────────────────────────────────────────────────

/// Transferring to oneself leaves the balance unchanged.
#[test]
fn transfer_to_self_balance_unchanged() {
    let (e, client, admin) = setup();
    let before = client.balance(&admin);
    client.transfer(&admin, &admin, &(100 * TYC));
    assert_eq!(client.balance(&admin), before);
}

// ── edge: transfer_from where spender == from ────────────────────────────────

/// `transfer_from` where `spender == from` — user approves themselves (unusual but valid).
#[test]
fn transfer_from_spender_is_from_self_approved() {
    let (e, client, admin) = setup();
    let recipient = Address::generate(&e);

    // Admin approves themselves as spender
    client.approve(&admin, &admin, &(10 * TYC), &0);
    client.transfer_from(&admin, &admin, &recipient, &(5 * TYC));

    assert_eq!(client.balance(&recipient), 5 * TYC);
    assert_eq!(client.allowance(&admin, &admin), 5 * TYC);
}

// ── integration: mint → approve → transfer_from → burn_from chain ────────────

/// Full chain: admin mints to user, user approves protocol, protocol transfer_from
/// then burn_from — verifies all state changes are consistent end-to-end.
#[test]
fn integration_mint_approve_transfer_burn_chain() {
    let (e, client, admin) = setup();
    let user = Address::generate(&e);
    let protocol = Address::generate(&e);
    let treasury = Address::generate(&e);

    // Step 1: admin mints 100 TYC to user
    client.mint(&user, &(100 * TYC));
    assert_eq!(client.balance(&user), 100 * TYC);
    assert_eq!(client.total_supply(), SUPPLY + 100 * TYC);

    // Step 2: user approves protocol to spend 60 TYC
    client.approve(&user, &protocol, &(60 * TYC), &0);
    assert_eq!(client.allowance(&user, &protocol), 60 * TYC);

    // Step 3: protocol moves 40 TYC from user to treasury
    client.transfer_from(&protocol, &user, &treasury, &(40 * TYC));
    assert_eq!(client.balance(&user), 60 * TYC);
    assert_eq!(client.balance(&treasury), 40 * TYC);
    assert_eq!(client.allowance(&user, &protocol), 20 * TYC);
    assert_eq!(client.total_supply(), SUPPLY + 100 * TYC); // no burn yet

    // Step 4: protocol burns remaining 20 TYC from user as fee
    client.burn_from(&protocol, &user, &(20 * TYC));
    assert_eq!(client.balance(&user), 40 * TYC);
    assert_eq!(client.allowance(&user, &protocol), 0);
    assert_eq!(client.total_supply(), SUPPLY + 80 * TYC); // 100 minted - 20 burned
}

/// Sequential `approve` calls by the same owner overwrite — allowances do not
/// accumulate across multiple `approve` calls for the same `(from, spender)`.
#[test]
fn integration_approve_overwrite_not_accumulate() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);

    for amount in [10 * TYC, 20 * TYC, 5 * TYC] {
        client.approve(&admin, &spender, &amount, &0);
        assert_eq!(
            client.allowance(&admin, &spender),
            amount,
            "approve should overwrite, current amount {amount}"
        );
    }
    // Final allowance must be 5 TYC, not the sum 35 TYC
    assert_eq!(client.allowance(&admin, &spender), 5 * TYC);
}

/// Multiple independent spenders of the same owner each hold their own allowance.
#[test]
fn integration_multiple_spenders_independent_allowances() {
    let (e, client, admin) = setup();
    let spender_a = Address::generate(&e);
    let spender_b = Address::generate(&e);
    let spender_c = Address::generate(&e);

    client.approve(&admin, &spender_a, &(10 * TYC), &0);
    client.approve(&admin, &spender_b, &(20 * TYC), &0);
    client.approve(&admin, &spender_c, &(30 * TYC), &0);

    assert_eq!(client.allowance(&admin, &spender_a), 10 * TYC);
    assert_eq!(client.allowance(&admin, &spender_b), 20 * TYC);
    assert_eq!(client.allowance(&admin, &spender_c), 30 * TYC);

    // Spending from spender_b does not affect spender_a or spender_c
    let recipient = Address::generate(&e);
    client.transfer_from(&spender_b, &admin, &recipient, &(5 * TYC));

    assert_eq!(client.allowance(&admin, &spender_a), 10 * TYC);
    assert_eq!(client.allowance(&admin, &spender_b), 15 * TYC);
    assert_eq!(client.allowance(&admin, &spender_c), 30 * TYC);
}
