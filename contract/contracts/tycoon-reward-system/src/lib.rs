#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const VOUCHER_ID_START: u128 = 1_000_000_000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // (Owner, TokenID) -> Amount
    Balance(Address, u128),
    // TokenID -> Value
    VoucherValue(u128),
    // TokenID -> Perk Enum (u32)
    CollectiblePerk(u128),
    // TokenID -> Strength
    CollectibleStrength(u128),
    // TokenID -> Price
    CollectibleTyc(u128),
    CollectibleUsdc(u128),
    Admin,
    TycToken,
    UsdcToken,
    VoucherCount,
    Paused,
    // Backend minter address (optional - None if not set)
    BackendMinter,
    // (Owner) -> Total distinct vouchers owned
    OwnedTokenCount(Address),
    StateVersion,
}

#[contract]
pub struct TycoonRewardSystem;

// ── Internal helper ───────────────────────────────────────────────────────────

impl TycoonRewardSystem {
    fn require_admin(e: &Env) -> Address {
        e.storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized")
    }
}

// ── Admin-only entrypoints ────────────────────────────────────────────────────
//
// Every function here calls `require_admin` and `admin.require_auth()` before
// touching state. Callers must be the stored `admin` address.

#[contractimpl]
impl TycoonRewardSystem {
    /// Initialize the contract (one-time setup, admin only).
    ///
    /// # Errors
    /// - Panics with `"Already initialized"` if called more than once.
    pub fn initialize(e: Env, admin: Address, tyc_token: Address, usdc_token: Address) {
        if e.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        e.storage().persistent().set(&DataKey::Admin, &admin);
        e.storage().persistent().set(&DataKey::TycToken, &tyc_token);
        e.storage()
            .persistent()
            .set(&DataKey::UsdcToken, &usdc_token);
        e.storage()
            .persistent()
            .set(&DataKey::VoucherCount, &VOUCHER_ID_START);
        e.storage().persistent().set(&DataKey::Paused, &false);
        e.storage().persistent().set(&DataKey::StateVersion, &1u32);
    }

    /// Migrate the contract to a newer state version (admin only).
    pub fn admin_migrate(e: Env) {
        let admin = Self::require_admin(&e);
        admin.require_auth();

        let current_version: u32 = e
            .storage()
            .persistent()
            .get(&DataKey::StateVersion)
            .unwrap_or(0);

        if current_version == 0 {
            e.storage().persistent().set(&DataKey::StateVersion, &1u32);
        }
        // v1 → v2 migration placeholder
    }

    /// Emergency pause contract (admin only).
    pub fn admin_pause(e: Env) {
        let admin = Self::require_admin(&e);
        admin.require_auth();
        e.storage().persistent().set(&DataKey::Paused, &true);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("Paused"),), true);
    }

    /// Emergency unpause contract (admin only).
    pub fn admin_unpause(e: Env) {
        let admin = Self::require_admin(&e);
        admin.require_auth();
        e.storage().persistent().set(&DataKey::Paused, &false);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("Unpaused"),), false);
    }

    /// Set the backend minter address (admin only).
    pub fn admin_set_backend_minter(e: Env, new_minter: Address) {
        let admin = Self::require_admin(&e);
        admin.require_auth();
        e.storage()
            .persistent()
            .set(&DataKey::BackendMinter, &new_minter);
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("set_min"), new_minter), ());
    }

    /// Clear the backend minter address (admin only).
    pub fn admin_clear_backend_minter(e: Env) {
        let admin = Self::require_admin(&e);
        admin.require_auth();
        e.storage().persistent().remove(&DataKey::BackendMinter);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("clr_min"),), ());
    }

    /// Withdraw TYC or USDC from the contract treasury (admin only).
    ///
    /// # Errors
    /// - Panics with `"Invalid token: not in allowlist"` for unknown tokens.
    /// - Panics with `"Insufficient contract balance"` if balance is too low.
    pub fn admin_withdraw_funds(e: Env, token: Address, to: Address, amount: u128) {
        let admin = Self::require_admin(&e);
        admin.require_auth();

        let tyc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::TycToken)
            .expect("Not initialized");
        let usdc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::UsdcToken)
            .expect("Not initialized");

        if token != tyc_token && token != usdc_token {
            panic!("Invalid token: not in allowlist");
        }

        if amount > i128::MAX as u128 {
            panic!("amount exceeds i128::MAX");
        }

        let token_client = soroban_sdk::token::Client::new(&e, &token);
        let contract_address = e.current_contract_address();

        if token_client.balance(&contract_address) < amount as i128 {
            panic!("Insufficient contract balance");
        }

        token_client.transfer(&contract_address, &to, &(amount as i128));

        #[allow(deprecated)]
        e.events().publish(
            (Symbol::new(&e, "FundsWithdrawn"), token.clone(), to),
            amount,
        );
    }
}

// ── Public (user-initiated) entrypoints ──────────────────────────────────────
//
// These functions are callable by any authenticated user (subject to their own
// auth requirements). No admin check is performed at the entrypoint level.

#[contractimpl]
impl TycoonRewardSystem {
    /// Get the current backend minter address. Returns `None` if not set.
    pub fn get_backend_minter(e: Env) -> Option<Address> {
        e.storage().persistent().get(&DataKey::BackendMinter)
    }

    /// Mint a voucher for `to` with a TYC value of `tyc_value`.
    ///
    /// Authorized callers: admin or the registered backend minter.
    ///
    /// # Errors
    /// - Panics with `"Unauthorized: only admin or backend minter can mint"`
    ///   if the caller is neither.
    pub fn mint_voucher(e: Env, caller: Address, to: Address, tyc_value: u128) -> u128 {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        caller.require_auth();

        let backend_minter: Option<Address> = e.storage().persistent().get(&DataKey::BackendMinter);
        let is_authorized = caller == admin || backend_minter == Some(caller);

        if !is_authorized {
            panic!("Unauthorized: only admin or backend minter can mint");
        }

        let token_id: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherCount)
            .unwrap_or(VOUCHER_ID_START);
        e.storage().persistent().set(
            &DataKey::VoucherCount,
            &token_id.checked_add(1).expect("VoucherCount overflow"),
        );

        e.storage()
            .persistent()
            .set(&DataKey::VoucherValue(token_id), &tyc_value);

        Self::_mint(&e, to.clone(), token_id, 1);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("V_Mint"), to, token_id), tyc_value);

        token_id
    }

    /// Redeem a voucher held by `redeemer`. TYC is transferred to the redeemer.
    ///
    /// The `redeemer` must authorize this call and must own the voucher.
    ///
    /// # Errors
    /// - Panics with `"Contract is paused"` when the contract is paused.
    /// - Panics with `"Invalid token_id"` if the voucher does not exist.
    /// - Panics with `"Insufficient balance"` if the redeemer does not own the voucher.
    pub fn redeem_voucher_from(e: Env, redeemer: Address, token_id: u128) {
        redeemer.require_auth();

        if e.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
            panic!("Contract is paused");
        }

        let tyc_value: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherValue(token_id))
            .expect("Invalid token_id");

        Self::_burn(&e, redeemer.clone(), token_id, 1);

        let tyc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::TycToken)
            .expect("Not initialized");

        soroban_sdk::token::Client::new(&e, &tyc_token).transfer(
            &e.current_contract_address(),
            &redeemer,
            &(tyc_value as i128),
        );

        e.storage()
            .persistent()
            .remove(&DataKey::VoucherValue(token_id));

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Redeem"), redeemer, token_id), tyc_value);
    }

    /// Return the voucher balance (0 or 1) of `owner` for `token_id`.
    pub fn get_balance(e: Env, owner: Address, token_id: u128) -> u64 {
        Self::balance_of(&e, owner, token_id)
    }

    /// Return the number of distinct voucher tokens owned by `owner`.
    pub fn owned_token_count(e: Env, owner: Address) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::OwnedTokenCount(owner))
            .unwrap_or(0)
    }

    /// Transfer `amount` of `token_id` from `from` to `to`.
    ///
    /// The `from` address must authorize this call.
    ///
    /// # Errors
    /// - Panics with `"Contract is paused"` when the contract is paused.
    /// - Panics with `"Insufficient balance"` if `from` does not own enough.
    pub fn transfer(e: Env, from: Address, to: Address, token_id: u128, amount: u64) {
        from.require_auth();

        if e.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
            panic!("Contract is paused");
        }

        Self::_burn(&e, from.clone(), token_id, amount);
        Self::_mint(&e, to.clone(), token_id, amount);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Transfer"), from, to, token_id), amount);
    }
}

// ── Deprecated shims ──────────────────────────────────────────────────────────
//
// These thin wrappers preserve the old entrypoint names so that existing
// integrations continue to compile. They will be removed in the next major
// version. New code must use the `admin_*` variants above.

#[contractimpl]
impl TycoonRewardSystem {
    /// Deprecated — use `admin_migrate` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_migrate instead")]
    pub fn migrate(e: Env) {
        Self::admin_migrate(e);
    }

    /// Deprecated — use `admin_pause` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_pause instead")]
    pub fn pause(e: Env) {
        Self::admin_pause(e);
    }

    /// Deprecated — use `admin_unpause` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_unpause instead")]
    pub fn unpause(e: Env) {
        Self::admin_unpause(e);
    }

    /// Deprecated — use `admin_set_backend_minter` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_set_backend_minter instead")]
    pub fn set_backend_minter(e: Env, new_minter: Address) {
        Self::admin_set_backend_minter(e, new_minter);
    }

    /// Deprecated — use `admin_clear_backend_minter` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_clear_backend_minter instead")]
    pub fn clear_backend_minter(e: Env) {
        Self::admin_clear_backend_minter(e);
    }

    /// Deprecated — use `admin_withdraw_funds` instead.
    #[deprecated(since = "0.2.0", note = "Use admin_withdraw_funds instead")]
    pub fn withdraw_funds(e: Env, token: Address, to: Address, amount: u128) {
        Self::admin_withdraw_funds(e, token, to, amount);
    }

    /// Deprecated — always panics. Use `redeem_voucher_from` instead.
    #[deprecated(since = "0.1.0", note = "Use redeem_voucher_from instead")]
    pub fn redeem_voucher(_e: Env, _token_id: u128) {
        panic!("Use redeem_voucher_from instead");
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

impl TycoonRewardSystem {
    fn _mint(e: &Env, to: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(to.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = current_balance
            .checked_add(amount)
            .expect("Balance overflow");
        e.storage().persistent().set(&key, &new_balance);

        if current_balance == 0 {
            let count_key = DataKey::OwnedTokenCount(to.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            e.storage().persistent().set(&count_key, &(count + 1));
        }

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Mint"), to, token_id), amount);
    }

    fn _burn(e: &Env, from: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(from.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);

        if current_balance < amount {
            panic!("Insufficient balance");
        }

        let new_balance = current_balance - amount;

        if new_balance == 0 {
            e.storage().persistent().remove(&key);

            let count_key = DataKey::OwnedTokenCount(from.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            if count > 0 {
                let updated = count - 1;
                if updated == 0 {
                    e.storage().persistent().remove(&count_key);
                } else {
                    e.storage().persistent().set(&count_key, &updated);
                }
            }
        } else {
            e.storage().persistent().set(&key, &new_balance);
        }

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Burn"), from, token_id), amount);
    }

    fn balance_of(e: &Env, owner: Address, token_id: u128) -> u64 {
        e.storage()
            .persistent()
            .get(&DataKey::Balance(owner, token_id))
            .unwrap_or(0)
    }
}

#[cfg(test)]
#[contractimpl]
impl TycoonRewardSystem {
    #[deprecated(note = "Test function - will be removed in future version")]
    pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
        Self::_mint(&e, to, token_id, amount);
    }

    #[deprecated(note = "Test function - will be removed in future version")]
    pub fn test_burn(e: Env, from: Address, token_id: u128, amount: u64) {
        Self::_burn(&e, from, token_id, amount);
    }
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod overflow_rounding_tests;

#[cfg(test)]
mod admin_access_control_tests;
#[cfg(test)]
mod transfer_tests;

#[cfg(test)]
mod simulation_scenarios;

#[cfg(test)]
mod security_review_tests;
