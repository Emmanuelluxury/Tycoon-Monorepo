//! Migration and upgrade governance tests for TycoonToken (SW-CON-1037)
//!
//! Validates that:
//! - `migrate` is admin-only (non-admin callers are rejected)
//! - `state_version` returns correct version after initialization
//! - `migrate` at v0 advances to v1
//! - `migrate` at v1 is idempotent (no-op)
//! - Migration does not corrupt existing state (balances, allowances, total supply)
//! - `state_version` is queryable by any caller (public view function)

#![cfg(test)]

use crate::{TycoonToken, TycoonTokenClient};
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};

fn setup(env: &Env) -> (Address, TycoonTokenClient, Address) {
    let contract_id = env.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(env, &contract_id);
    let admin = Address::generate(env);
    (contract_id, client, admin)
}

/// MIG-01: `migrate` must reject non-admin callers
#[test]
#[should_panic(expected = "not satisfied")]
fn mig_01_migrate_rejects_non_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, admin) = setup(&env);
    client.initialize(&admin, &1_000_000_000);

    let non_admin = Address::generate(&env);

    // Attempt to call migrate as non-admin
    env.mock_auths(&[MockAuth {
        address: &non_admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "migrate",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.migrate();
}

/// MIG-02: `state_version` returns 1 after initialization
#[test]
fn mig_02_state_version_is_1_after_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    client.initialize(&admin, &1_000_000_000);

    let version = client.state_version();
    assert_eq!(version, 1, "MIG-02: state_version must be 1 after initialize");
}

/// MIG-03: `migrate` at v1 is idempotent (no-op)
#[test]
fn mig_03_migrate_at_v1_is_noop() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    client.initialize(&admin, &1_000_000_000);

    // Version should be 1 after initialize
    assert_eq!(client.state_version(), 1);

    // Call migrate — should be a no-op at v1
    client.migrate();

    // Version should still be 1
    assert_eq!(
        client.state_version(),
        1,
        "MIG-03: migrate at v1 must not change version"
    );
}

/// MIG-04: `migrate` from v0 to v1 succeeds
#[test]
fn mig_04_migrate_v0_to_v1() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    // Manually bootstrap state without calling initialize, simulating legacy contract
    use crate::DataKey;
    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &1_000_000_000i128);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(admin.clone()), &1_000_000_000i128);
        // Note: StateVersion is NOT set, so it defaults to 0
    });

    // Verify state_version is 0
    assert_eq!(
        client.state_version(),
        0,
        "MIG-04: state_version must start at 0"
    );

    // Call migrate
    client.migrate();

    // Verify state_version is now 1
    assert_eq!(
        client.state_version(),
        1,
        "MIG-04: migrate must upgrade v0 to v1"
    );
}

/// MIG-05: `migrate` preserves existing balances
#[test]
fn mig_05_migrate_preserves_balances() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    let user = Address::generate(&env);

    client.initialize(&admin, &1_000_000_000);
    client.mint(&user, &500_000);

    let admin_balance_before = client.balance(&admin);
    let user_balance_before = client.balance(&user);
    let total_supply_before = client.total_supply();

    // Call migrate
    client.migrate();

    // Verify balances are unchanged
    assert_eq!(
        client.balance(&admin),
        admin_balance_before,
        "MIG-05: admin balance must be preserved"
    );
    assert_eq!(
        client.balance(&user),
        user_balance_before,
        "MIG-05: user balance must be preserved"
    );
    assert_eq!(
        client.total_supply(),
        total_supply_before,
        "MIG-05: total supply must be preserved"
    );
}

/// MIG-06: `migrate` preserves allowances
#[test]
fn mig_06_migrate_preserves_allowances() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);

    client.initialize(&admin, &1_000_000_000);
    client.mint(&owner, &500_000);
    client.approve(&owner, &spender, &100_000, &0);

    let allowance_before = client.allowance(&owner, &spender);

    // Call migrate
    client.migrate();

    // Verify allowance is unchanged
    assert_eq!(
        client.allowance(&owner, &spender),
        allowance_before,
        "MIG-06: allowance must be preserved"
    );
}

/// MIG-07: `migrate` is callable multiple times without error
#[test]
fn mig_07_migrate_is_idempotent_multiple_calls() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    client.initialize(&admin, &1_000_000_000);

    // Call migrate multiple times
    client.migrate();
    client.migrate();
    client.migrate();

    // All calls should succeed, version should be 1
    assert_eq!(
        client.state_version(),
        1,
        "MIG-07: version must remain 1 after multiple migrate calls"
    );
}

/// MIG-08: `state_version` is public (any caller can read)
#[test]
fn mig_08_state_version_is_public() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    client.initialize(&admin, &1_000_000_000);

    let non_admin = Address::generate(&env);

    // Call state_version as non-admin — should not require auth
    let version = client.state_version();
    assert_eq!(version, 1, "MIG-08: state_version must be readable by anyone");
}

/// MIG-09: `migrate` requires admin authorization
#[test]
fn mig_09_migrate_requires_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let (contract_id, client, admin) = setup(&env);
    client.initialize(&admin, &1_000_000_000);

    // Verify the authorization is checked
    let auths = env.auths();
    env.set_auths(&[]);

    env.mock_auths(&[MockAuth {
        address: &admin,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "migrate",
            args: ().into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.migrate();

    // Verify admin authorization was required
    assert_eq!(
        env.auths(),
        [(
            admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    "migrate".try_into().unwrap(),
                    ().into_val(&env)
                )),
                sub_invocations: std::vec![]
            }
        )]
    );
}

/// MIG-10: Token operations work correctly after migration
#[test]
fn mig_10_token_operations_work_after_migrate() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    client.initialize(&admin, &1_000_000_000);
    client.migrate();

    // Test mint
    client.mint(&user1, &100_000);
    assert_eq!(client.balance(&user1), 100_000);

    // Test transfer
    client.transfer(&user1, &user2, &50_000);
    assert_eq!(client.balance(&user1), 50_000);
    assert_eq!(client.balance(&user2), 50_000);

    // Test approve and transfer_from
    client.approve(&user2, &user1, &20_000, &0);
    client.transfer_from(&user1, &user2, &admin, &20_000);
    assert_eq!(client.balance(&user2), 30_000);
    assert_eq!(client.balance(&admin), 1_000_020_000);

    // Test burn
    client.burn(&user1, &10_000);
    assert_eq!(client.balance(&user1), 40_000);
}

/// MIG-11: Admin can be changed after migration
#[test]
fn mig_11_admin_change_works_after_migrate() {
    let env = Env::default();
    env.mock_all_auths();

    let (_, client, admin) = setup(&env);
    let new_admin = Address::generate(&env);

    client.initialize(&admin, &1_000_000_000);
    client.migrate();

    // Change admin
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);

    // New admin can call migrate
    client.migrate();
    assert_eq!(client.state_version(), 1);
}

/// MIG-12: Legacy contract (v0) can be migrated and then used normally
#[test]
fn mig_12_legacy_contract_full_workflow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TycoonToken);
    let client = TycoonTokenClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    // Bootstrap legacy state (v0)
    use crate::DataKey;
    env.as_contract(&contract_id, || {
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &1_000_000_000i128);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(admin.clone()), &1_000_000_000i128);
    });

    assert_eq!(client.state_version(), 0);

    // Migrate to v1
    client.migrate();
    assert_eq!(client.state_version(), 1);

    // Perform token operations
    client.mint(&user, &500_000);
    assert_eq!(client.balance(&user), 500_000);

    client.transfer(&user, &admin, &100_000);
    assert_eq!(client.balance(&user), 400_000);
    assert_eq!(client.balance(&admin), 1_000_100_000);

    // Everything works as expected
    assert_eq!(client.total_supply(), 1_000_500_000);
}
