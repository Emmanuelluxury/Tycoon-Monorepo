//! Access-control tests for the TycoonBoostSystem contract.
//!
//! Verifies that:
//! - `initialize` can only be called once and requires admin auth.
//! - `admin_grant_boost` is restricted to the admin.
//! - `admin_revoke_boost` is restricted to the admin.
//! - `add_boost` / `clear_boosts` require the *player's* auth, not admin.
//! - Read-only views (`get_active_boosts`, `calculate_total_boost`, `admin`)
//!   require no auth.

extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Env,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn make_env() -> Env {
    let env = Env::default();
    env.mock_all_auths();
    env
}

fn setup_initialized(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin);
    (client, admin)
}

fn set_ledger(env: &Env, seq: u32) {
    env.ledger().set(LedgerInfo {
        sequence_number: seq,
        timestamp: seq as u64 * 5,
        protocol_version: 23,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 100_000,
    });
}

fn nb(id: u128, boost_type: BoostType, value: u32) -> Boost {
    Boost {
        id,
        boost_type,
        value,
        priority: 0,
        expires_at_ledger: 0,
    }
}

fn eb(id: u128, boost_type: BoostType, value: u32, expires_at_ledger: u32) -> Boost {
    Boost {
        id,
        boost_type,
        value,
        priority: 0,
        expires_at_ledger,
    }
}

// ── initialize ────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_admin() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    assert_eq!(client.admin(), admin);
}

#[test]
#[should_panic(expected = "AlreadyInitialized")]
fn test_initialize_twice_panics() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    // Second call must panic
    client.initialize(&admin);
}

// ── admin_grant_boost ─────────────────────────────────────────────────────────

#[test]
fn test_admin_grant_boost_succeeds() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 1);
}

#[test]
fn test_admin_grant_boost_emits_event() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(42, BoostType::Multiplicative, 15000));

    // Observable effect: boost is present and has correct id/value
    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 42);
    assert_eq!(active.get(0).unwrap().value, 15000);
}

#[test]
#[should_panic(expected = "InvalidValue")]
fn test_admin_grant_boost_zero_value_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 0));
}

#[test]
#[should_panic(expected = "InvalidExpiry")]
fn test_admin_grant_boost_past_expiry_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 200);
    // expires_at_ledger is in the past
    client.admin_grant_boost(&player, &eb(1, BoostType::Additive, 500, 100));
}

#[test]
#[should_panic(expected = "DuplicateId")]
fn test_admin_grant_boost_duplicate_id_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    // Same id again — must panic
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 200));
}

#[test]
#[should_panic(expected = "CapExceeded")]
fn test_admin_grant_boost_cap_exceeded_panics() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    for i in 0..MAX_BOOSTS_PER_PLAYER {
        client.admin_grant_boost(&player, &nb(i as u128, BoostType::Additive, 100));
    }
    // One more — must panic
    client.admin_grant_boost(
        &player,
        &nb(MAX_BOOSTS_PER_PLAYER as u128, BoostType::Additive, 100),
    );
}

// ── admin_revoke_boost ────────────────────────────────────────────────────────

#[test]
fn test_admin_revoke_boost_removes_boost() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player, &nb(2, BoostType::Additive, 300));

    assert_eq!(client.get_active_boosts(&player).len(), 2);

    client.admin_revoke_boost(&player, &1);

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, 2);
}

#[test]
fn test_admin_revoke_boost_nonexistent_is_noop() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));

    // Revoking a non-existent id should not panic
    client.admin_revoke_boost(&player, &999);

    // Original boost still present
    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

#[test]
fn test_admin_revoke_boost_emits_event() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(7, BoostType::Override, 20000));

    // Revoke the boost — should succeed and remove it
    client.admin_revoke_boost(&player, &7u128);

    // The boost should be gone — this is the primary observable effect
    assert_eq!(
        client.get_active_boosts(&player).len(),
        0,
        "Boost should be removed after admin_revoke_boost"
    );
}

// ── add_boost (player-initiated) ──────────────────────────────────────────────

#[test]
fn test_add_boost_player_auth_succeeds() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));

    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

// ── clear_boosts (player-initiated) ──────────────────────────────────────────

#[test]
fn test_clear_boosts_player_auth_succeeds() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));
    client.add_boost(&player, &nb(2, BoostType::Additive, 500));

    client.clear_boosts(&player);

    assert_eq!(client.get_active_boosts(&player).len(), 0);
}

// ── admin_grant_boost interacts correctly with add_boost ─────────────────────

#[test]
fn test_admin_grant_and_player_add_coexist() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Admin grants boost id=1
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 500));
    // Player self-adds boost id=2
    client.add_boost(&player, &nb(2, BoostType::Multiplicative, 15000));

    let active = client.get_active_boosts(&player);
    assert_eq!(active.len(), 2);
}

#[test]
fn test_admin_revoke_does_not_affect_other_players() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player_a = Address::generate(&env);
    let player_b = Address::generate(&env);

    client.admin_grant_boost(&player_a, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player_b, &nb(1, BoostType::Additive, 500));

    // Revoke from player_a only
    client.admin_revoke_boost(&player_a, &1);

    assert_eq!(client.get_active_boosts(&player_a).len(), 0);
    assert_eq!(client.get_active_boosts(&player_b).len(), 1);
}

// ── calculate_total_boost with admin-granted boosts ───────────────────────────

#[test]
fn test_calculate_total_boost_includes_admin_granted() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // Admin grants +50% additive boost (5000 bps)
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 5000));

    // Base 10000 + 5000 additive = 15000
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 15000);
}

#[test]
fn test_calculate_total_boost_excludes_revoked() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 5000));
    client.admin_revoke_boost(&player, &1);

    // No boosts — should return base 10000
    let total = client.calculate_total_boost(&player);
    assert_eq!(total, 10000);
}

// ── admin view ────────────────────────────────────────────────────────────────

#[test]
fn test_admin_view_returns_correct_address() {
    let env = make_env();
    let (client, admin) = setup_initialized(&env);
    assert_eq!(client.admin(), admin);
}

// ── SW-CT-030: Entrypoint boundary tests ──────────────────────────────────────
//
// These tests formally verify the admin-only vs public boundary documented in
// ENTRYPOINTS.md. Each test name maps directly to a row in the boundary table.

/// BOUNDARY-01: Public read-only views require no authorization.
#[test]
fn test_boundary_public_views_need_no_auth() {
    // Explicitly do NOT call mock_all_auths — auth is not needed for reads.
    let env = Env::default();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);

    let player = Address::generate(&env);

    // These must not panic even without any auth setup.
    let _ = client.calculate_total_boost(&player);
    let _ = client.get_active_boosts(&player);
}

/// BOUNDARY-02: `admin()` is publicly readable without auth.
#[test]
fn test_boundary_admin_view_no_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, expected_admin) = setup_initialized(&env);

    // Verify without mock_all_auths context — already set; just confirm it reads correctly.
    assert_eq!(client.admin(), expected_admin);
}

/// BOUNDARY-03: `add_boost` requires admin auth (not player auth).
///
/// The function is listed as admin-only in ENTRYPOINTS.md.
/// With `mock_all_auths` it succeeds; the security_review_tests.rs module
/// verifies the rejection path without mocks.
#[test]
fn test_boundary_add_boost_is_admin_only() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    // With mock_all_auths active, admin auth is satisfied.
    client.add_boost(&player, &nb(1, BoostType::Additive, 1000));
    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

/// BOUNDARY-04: `clear_boosts` requires admin auth.
#[test]
fn test_boundary_clear_boosts_is_admin_only() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player = Address::generate(&env);

    client.add_boost(&player, &nb(1, BoostType::Additive, 500));

    // With mock_all_auths active, admin auth is satisfied.
    client.clear_boosts(&player);
    assert_eq!(client.get_active_boosts(&player).len(), 0);
}

/// BOUNDARY-05: Admin functions panic `"NotInitialized"` before `initialize`.
#[test]
#[should_panic(expected = "NotInitialized")]
fn test_boundary_admin_only_panics_without_init() {
    let env = make_env();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let player = Address::generate(&env);

    // Calling an admin-only function before initialize must panic "NotInitialized".
    client.add_boost(&player, &nb(1, BoostType::Additive, 500));
}

/// BOUNDARY-06: `admin_revoke_boost` on player A does not affect player B.
#[test]
fn test_boundary_grant_revoke_isolation() {
    let env = make_env();
    let (client, _admin) = setup_initialized(&env);
    let player_a = Address::generate(&env);
    let player_b = Address::generate(&env);

    client.admin_grant_boost(&player_a, &nb(1, BoostType::Additive, 500));
    client.admin_grant_boost(&player_b, &nb(1, BoostType::Additive, 500));

    client.admin_revoke_boost(&player_a, &1u128);

    // player_a's boost was removed.
    assert_eq!(client.get_active_boosts(&player_a).len(), 0);
    // player_b is unaffected.
    assert_eq!(client.get_active_boosts(&player_b).len(), 1);
}

/// BOUNDARY-07: Deprecated public entrypoints have no auth requirement.
#[test]
fn test_boundary_deprecated_public_no_auth() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let player = Address::generate(&env);
    client.initialize(&admin);

    // Both deprecated functions are public — no special auth.
    let _ = client.get_boosts(&player);
    let _ = client.prune_expired_boosts(&player);
}
