//! SW-CT-027: Simulation scenarios — tycoon-boost-system
//!
//! Realistic game-session scenarios exercising the boost system end-to-end.
//! Each scenario is self-contained with its own Env.
//!
//! | ID     | Scenario |
//! |--------|----------|
//! | SIM-01 | New player receives admin-granted boost; total reflects it |
//! | SIM-02 | Player boost expires mid-session; total falls back to base |
//! | SIM-03 | Admin revokes boost mid-session; total falls back to base |
//! | SIM-04 | Player fills cap, one expires, new boost fits in freed slot |
//! | SIM-05 | Multiple players are isolated; one player's boosts don't affect another |
//! | SIM-06 | Mixed boost types across a full game round produce correct total |
//! | SIM-07 | Admin clears all boosts at end of season; all players reset to base |

extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env,
};

fn setup(env: &Env) -> (TycoonBoostSystemClient, Address) {
    let id = env.register(TycoonBoostSystem, ());
    let client = TycoonBoostSystemClient::new(env, &id);
    let admin = Address::generate(env);
    env.mock_all_auths();
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

fn eb(id: u128, boost_type: BoostType, value: u32, expires: u32) -> Boost {
    Boost {
        id,
        boost_type,
        value,
        priority: 0,
        expires_at_ledger: expires,
    }
}

// ── SIM-01 ────────────────────────────────────────────────────────────────────

/// New player receives an admin-granted boost; calculate_total_boost reflects it.
#[test]
fn sim_01_new_player_receives_admin_boost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    assert_eq!(client.calculate_total_boost(&player), 10000); // base

    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 2000)); // +20%

    assert_eq!(client.calculate_total_boost(&player), 12000);
}

// ── SIM-02 ────────────────────────────────────────────────────────────────────

/// Boost expires mid-session; total falls back to base at next ledger.
#[test]
fn sim_02_boost_expires_mid_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 100);
    client.admin_grant_boost(&player, &eb(1, BoostType::Additive, 3000, 110)); // expires at 110

    set_ledger(&env, 105);
    assert_eq!(client.calculate_total_boost(&player), 13000); // still active

    set_ledger(&env, 110);
    assert_eq!(client.calculate_total_boost(&player), 10000); // expired
}

// ── SIM-03 ────────────────────────────────────────────────────────────────────

/// Admin revokes a boost mid-session; total falls back to base immediately.
#[test]
fn sim_03_admin_revokes_boost_mid_session() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    client.admin_grant_boost(&player, &nb(1, BoostType::Multiplicative, 15000)); // 1.5x
    assert_eq!(client.calculate_total_boost(&player), 15000);

    client.admin_revoke_boost(&player, &1u128);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── SIM-04 ────────────────────────────────────────────────────────────────────

/// Player fills cap; one boost expires; new boost fits in the freed slot.
#[test]
fn sim_04_cap_freed_by_expiry_allows_new_boost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 50);
    // Fill cap: 9 permanent + 1 expiring at ledger 60
    for i in 0..9u128 {
        client.add_boost(&player, &nb(i, BoostType::Additive, 100));
    }
    client.add_boost(&player, &eb(9, BoostType::Additive, 100, 60));
    assert_eq!(client.get_active_boosts(&player).len(), 10);

    // Advance past expiry — slot freed
    set_ledger(&env, 61);
    // Adding a new boost triggers prune; cap slot is now free
    client.add_boost(&player, &nb(10, BoostType::Additive, 500));
    assert_eq!(client.get_active_boosts(&player).len(), 10); // still 10 (9 perm + 1 new)
}

// ── SIM-05 ────────────────────────────────────────────────────────────────────

/// Multiple players are isolated; boosts on one don't affect another.
#[test]
fn sim_05_multi_player_isolation() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.admin_grant_boost(&alice, &nb(1, BoostType::Additive, 5000));
    client.admin_grant_boost(&bob, &nb(1, BoostType::Multiplicative, 20000));

    assert_eq!(client.calculate_total_boost(&alice), 15000); // base + 50%
    assert_eq!(client.calculate_total_boost(&bob), 20000); // 2x

    client.admin_revoke_boost(&alice, &1u128);
    assert_eq!(client.calculate_total_boost(&alice), 10000); // reset
    assert_eq!(client.calculate_total_boost(&bob), 20000); // unchanged
}

// ── SIM-06 ────────────────────────────────────────────────────────────────────

/// Mixed boost types across a full game round produce the correct combined total.
/// Formula: multiplicative_chain × (1 + additive_sum) — override absent.
#[test]
fn sim_06_mixed_boost_full_round() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    // 1.5x multiplicative (15000 bps)
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 15000));
    // +20% additive (2000 bps)
    client.add_boost(&player, &nb(2, BoostType::Additive, 2000));
    // +10% additive (1000 bps)
    client.add_boost(&player, &nb(3, BoostType::Additive, 1000));

    // Expected: 10000 * 1.5 * (1 + 0.30) = 15000 * 1.30 = 19500
    assert_eq!(client.calculate_total_boost(&player), 19500);
}

// ── SIM-07 ────────────────────────────────────────────────────────────────────

/// End-of-season: admin clears all boosts for every player; all return to base.
#[test]
fn sim_07_end_of_season_clear_all_players() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);

    let players = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];

    for (i, p) in players.iter().enumerate() {
        client.admin_grant_boost(p, &nb(1, BoostType::Additive, (i as u32 + 1) * 1000));
    }

    // Verify all have boosts
    for p in &players {
        assert!(client.calculate_total_boost(p) > 10000);
    }

    // End-of-season clear
    for p in &players {
        client.clear_boosts(p);
    }

    // All back to base
    for p in &players {
        assert_eq!(client.calculate_total_boost(p), 10000);
    }
}

// ── SIM-08 ────────────────────────────────────────────────────────────────────

/// Admin grants a limited-time tournament boost; player competes during the
/// boost window; boost expires when the tournament ends.
#[test]
fn sim_08_tournament_boost_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    let tournament_start = 1000u32;
    let tournament_end = 2000u32;

    set_ledger(&env, tournament_start);
    // Grant a 2x multiplicative boost for the tournament window
    client.admin_grant_boost(
        &player,
        &eb(1, BoostType::Multiplicative, 20000, tournament_end + 1),
    );

    // Mid-tournament: boost is active
    set_ledger(&env, 1500);
    assert_eq!(client.calculate_total_boost(&player), 20000);

    // Right at tournament end: boost expires (expires_at_ledger == current ⇒ expired)
    set_ledger(&env, tournament_end + 1);
    assert_eq!(client.calculate_total_boost(&player), 10000);
}

// ── SIM-09 ────────────────────────────────────────────────────────────────────

/// Player earns a permanent loyalty boost then stacks a temporary event boost
/// on top; event expires while loyalty remains.
#[test]
fn sim_09_loyalty_plus_event_boost_stack() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 100);

    // Permanent loyalty: +10% additive
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000));

    // Temporary event: +25% additive (expires at 200)
    client.admin_grant_boost(&player, &eb(2, BoostType::Additive, 2500, 200));

    // During event: base * (1 + 0.10 + 0.25) = 13500
    set_ledger(&env, 150);
    assert_eq!(client.calculate_total_boost(&player), 13500);

    // After event expires: base * (1 + 0.10) = 11000
    set_ledger(&env, 200);
    assert_eq!(client.calculate_total_boost(&player), 11000);
}

// ── SIM-10 ────────────────────────────────────────────────────────────────────

/// Admin upgrades a player's boost mid-session: revoke old tier, grant new tier.
#[test]
fn sim_10_admin_upgrades_player_boost_tier() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    // Tier 1: +10%
    client.admin_grant_boost(&player, &nb(1, BoostType::Additive, 1000));
    assert_eq!(client.calculate_total_boost(&player), 11000);

    // Admin upgrades to Tier 2: revoke old, grant 1.5x multiplicative
    client.admin_revoke_boost(&player, &1u128);
    client.admin_grant_boost(&player, &nb(2, BoostType::Multiplicative, 15000));

    // Only Tier 2 applies
    assert_eq!(client.calculate_total_boost(&player), 15000);
    assert_eq!(client.get_active_boosts(&player).len(), 1);
}

// ── SIM-11 ────────────────────────────────────────────────────────────────────

/// Burst scenario: player accumulates boosts rapidly, hits cap, then a batch
/// of boosts expires allowing continued play.
#[test]
fn sim_11_rapid_accumulation_and_cap_relief() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    set_ledger(&env, 100);

    // Fill cap with short-lived boosts (expire at 200)
    for i in 0..MAX_BOOSTS_PER_PLAYER as u128 {
        client.add_boost(&player, &eb(i + 1, BoostType::Additive, 500, 200));
    }
    assert_eq!(client.get_active_boosts(&player).len(), 10);

    // All boosts active at ledger 150
    set_ledger(&env, 150);
    assert!(client.calculate_total_boost(&player) > 10000);

    // All expire at 200; new boosts can be added via automatic pruning in add_boost
    set_ledger(&env, 201);
    client.add_boost(&player, &nb(100, BoostType::Multiplicative, 15000));
    // Only the new permanent boost should be active
    assert_eq!(client.get_active_boosts(&player).len(), 1);
    assert_eq!(client.calculate_total_boost(&player), 15000);
}

// ── SIM-12 ────────────────────────────────────────────────────────────────────

/// Override boost trumps accumulated stack; removing override reveals the
/// underlying multiplicative + additive combination.
#[test]
fn sim_12_override_masks_and_reveals_stack() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let player = Address::generate(&env);

    // Underlying stack: 1.2x multiplicative + +15% additive
    client.add_boost(&player, &nb(1, BoostType::Multiplicative, 12000));
    client.add_boost(&player, &nb(2, BoostType::Additive, 1500));

    // Stack without override: 10000 * 1.2 * (1 + 0.15) = 13800
    assert_eq!(client.calculate_total_boost(&player), 13800);

    // Apply high-priority override (e.g., event bonus)
    client.admin_grant_boost(
        &player,
        &Boost {
            id: 3,
            boost_type: BoostType::Override,
            value: 25000,
            priority: 100,
            expires_at_ledger: 0,
        },
    );

    // Override masks underlying stack
    assert_eq!(client.calculate_total_boost(&player), 25000);

    // Admin revokes override (event ends)
    client.admin_revoke_boost(&player, &3u128);

    // Underlying stack re-emerges
    assert_eq!(client.calculate_total_boost(&player), 13800);
}
