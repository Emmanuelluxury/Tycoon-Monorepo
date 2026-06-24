/// # Tycoon Token — Simulation Scenarios (SW-CT-003)
///
/// Complex multi-step game scenarios that exercise the contract under realistic
/// Tycoon gameplay conditions.  Each scenario is self-contained and documents
/// the game mechanic it models.
///
/// | Scenario | Description |
/// |----------|-------------|
/// | `sim_game_reward_cycle` | Admin mints reward pool → winner paid out → winner burns fee |
/// | `sim_delegated_entry_stake` | Player approves game-contract → stake collected via `transfer_from` |
/// | `sim_multi_player_distribution` | 4 players receive starting cash; supply conserved throughout |
/// | `sim_admin_rotation` | Admin rotates to new key; new admin can mint, supply unchanged |
/// | `sim_burn_from_fee_collection` | Protocol burns on behalf of holder using approved allowance |
/// | `sim_tournament_prize_pool` | Multi-round tournament: 8 players, prize pool, per-round burn |
/// | `sim_marketplace_escrow` | Buyer approves escrow, escrow pays seller on match |
/// | `sim_staking_reward_and_slash` | Staker approves protocol, rewards minted, slash via burn_from |
/// | `sim_supply_deflation_over_rounds` | 5 game rounds each burning a % of supply; tracks deflation |
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Env,
};

const INITIAL_SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000; // 1B TYC
const TYC: i128 = 1_000_000_000_000_000_000; // 1 TYC

fn setup() -> (Env, TycoonTokenClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &INITIAL_SUPPLY);
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

// ── Scenario 1: game reward cycle ─────────────────────────────────────────────

/// Admin mints TYC into a reward pool.  Pool pays winner.  Winner burns 10 % as
/// protocol fee.  Verifies supply delta matches minted minus burned.
#[test]
fn sim_game_reward_cycle() {
    let (e, client, admin) = setup();
    let reward_pool = Address::generate(&e);
    let winner = Address::generate(&e);

    let reward: i128 = 5_000 * TYC;
    client.mint(&reward_pool, &reward);
    assert_eq!(client.balance(&reward_pool), reward);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + reward);

    let payout: i128 = 4_000 * TYC;
    client.transfer(&reward_pool, &winner, &payout);
    assert_eq!(client.balance(&winner), payout);
    assert_eq!(client.balance(&reward_pool), reward - payout);

    let fee: i128 = payout / 10; // 10 % burn fee
    client.burn(&winner, &fee);
    assert_eq!(client.balance(&winner), payout - fee);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + reward - fee);
}

// ── Scenario 2: delegated entry stake ─────────────────────────────────────────

/// Player approves game contract to spend their entry stake.
/// Game contract collects it via `transfer_from`.
/// Allowance is fully consumed — further spend rejected.
#[test]
fn sim_delegated_entry_stake() {
    let (e, client, admin) = setup();
    let player = Address::generate(&e);
    let game_contract = Address::generate(&e);
    let treasury = Address::generate(&e);

    let player_funds: i128 = 10_000 * TYC;
    client.transfer(&admin, &player, &player_funds);

    let stake: i128 = 1_000 * TYC;
    client.approve(&player, &game_contract, &stake, &0);
    assert_eq!(client.allowance(&player, &game_contract), stake);

    client.transfer_from(&game_contract, &player, &treasury, &stake);
    assert_eq!(client.balance(&player), player_funds - stake);
    assert_eq!(client.balance(&treasury), stake);
    assert_eq!(client.allowance(&player, &game_contract), 0);
}

// ── Scenario 3: multi-player starting distribution ───────────────────────────

/// 4 players each receive equal starting cash.
/// Players trade among themselves; total supply is always conserved.
#[test]
fn sim_multi_player_distribution() {
    let (e, client, admin) = setup();
    let players: [Address; 4] = [
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
    ];

    let starting_cash: i128 = 1_500 * TYC;
    for p in &players {
        client.transfer(&admin, p, &starting_cash);
    }

    // Supply conserved — just redistributed
    assert_eq!(client.total_supply(), INITIAL_SUPPLY);

    // Players trade among themselves
    client.transfer(&players[0], &players[1], &(500 * TYC));
    client.transfer(&players[2], &players[3], &(200 * TYC));

    assert_eq!(client.total_supply(), INITIAL_SUPPLY);
    let total_held: i128 = players.iter().map(|p| client.balance(p)).sum::<i128>()
        + client.balance(&admin);
    assert_eq!(total_held, INITIAL_SUPPLY);
}

// ── Scenario 4: admin rotation ────────────────────────────────────────────────

/// Old admin rotates to new admin.
/// New admin can mint; supply increases correctly.
#[test]
fn sim_admin_rotation() {
    let (e, client, admin) = setup();
    let new_admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);

    let amount: i128 = 1_000 * TYC;
    client.mint(&user, &amount);
    assert_eq!(client.balance(&user), amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + amount);
}

// ── Scenario 5: burn_from fee collection ─────────────────────────────────────

/// Protocol is approved to burn tokens on behalf of a holder.
/// Verifies balance, allowance, and supply all reflect the burn correctly.
#[test]
fn sim_burn_from_fee_collection() {
    let (e, client, admin) = setup();
    let holder = Address::generate(&e);
    let protocol = Address::generate(&e);

    let grant: i128 = 2_000 * TYC;
    client.transfer(&admin, &holder, &grant);

    let burn_allowance: i128 = 500 * TYC;
    client.approve(&holder, &protocol, &burn_allowance, &0);

    let burn_amount: i128 = 300 * TYC;
    client.burn_from(&protocol, &holder, &burn_amount);

    assert_eq!(client.balance(&holder), grant - burn_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - burn_amount);
    assert_eq!(
        client.allowance(&holder, &protocol),
        burn_allowance - burn_amount
    );
}

// ── Scenario 6: tournament prize pool (multi-round) ───────────────────────────

/// 8 players enter a tournament.  Each round the game contract collects entry fees
/// via `transfer_from` and burns 5 % as a protocol fee.  After 3 rounds:
/// - prize pool grows each round
/// - total supply shrinks by the cumulative fee
/// - winner claims the prize pool in the final round
#[test]
fn sim_tournament_prize_pool() {
    let (e, client, admin) = setup();
    let game_contract = Address::generate(&e);
    let prize_pool = Address::generate(&e);

    const N_PLAYERS: usize = 8;
    let players: [Address; 8] = [
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
    ];

    let player_balance: i128 = 500 * TYC;
    for p in &players {
        client.transfer(&admin, p, &player_balance);
    }

    let entry_fee: i128 = 100 * TYC;
    let burn_pct_num: i128 = 5;
    let burn_pct_den: i128 = 100;

    let mut supply = client.total_supply();

    // 3 rounds of entry fee collection
    for _round in 0..3usize {
        for p in &players {
            client.approve(p, &game_contract, &entry_fee, &0);
        }
        for p in &players {
            client.transfer_from(&game_contract, p, &prize_pool, &entry_fee);
        }
        // Burn 5 % of the round's collected fees
        let round_collected: i128 = entry_fee * N_PLAYERS as i128;
        let round_burn: i128 = round_collected * burn_pct_num / burn_pct_den;
        client.burn(&prize_pool, &round_burn);
        supply -= round_burn;
        assert_eq!(client.total_supply(), supply);
    }

    // Winner claims the remaining prize pool
    let winner = &players[0];
    let prize = client.balance(&prize_pool);
    client.transfer(&prize_pool, winner, &prize);
    assert_eq!(client.balance(&prize_pool), 0);
    assert_eq!(client.balance(winner), player_balance - 3 * entry_fee + prize);
    assert_eq!(client.total_supply(), supply); // supply unchanged by transfer
}

// ── Scenario 7: marketplace escrow ───────────────────────────────────────────

/// Buyer sets allowance for an escrow contract with a ledger-based deadline.
/// If the seller confirms before the deadline, escrow calls `transfer_from`.
/// If the deadline passes, the escrow cannot spend (allowance appears expired).
#[test]
fn sim_marketplace_escrow_confirmed_before_deadline() {
    let (e, client, admin) = setup();
    let buyer = Address::generate(&e);
    let seller = Address::generate(&e);
    let escrow = Address::generate(&e);

    let item_price: i128 = 250 * TYC;
    client.transfer(&admin, &buyer, &(1_000 * TYC));

    let deadline: u32 = 500;
    client.approve(&buyer, &escrow, &item_price, &deadline);

    set_seq(&e, 300); // well before deadline
    client.transfer_from(&escrow, &buyer, &seller, &item_price);

    assert_eq!(client.balance(&seller), item_price);
    assert_eq!(client.allowance(&buyer, &escrow), 0);
}

#[test]
#[should_panic(expected = "Allowance expired")]
fn sim_marketplace_escrow_deadline_missed() {
    let (e, client, admin) = setup();
    let buyer = Address::generate(&e);
    let seller = Address::generate(&e);
    let escrow = Address::generate(&e);

    let item_price: i128 = 250 * TYC;
    client.transfer(&admin, &buyer, &(1_000 * TYC));

    let deadline: u32 = 500;
    client.approve(&buyer, &escrow, &item_price, &deadline);

    set_seq(&e, 501); // deadline passed
    client.transfer_from(&escrow, &buyer, &seller, &item_price);
}

// ── Scenario 8: staking reward and slash ─────────────────────────────────────

/// Player stakes tokens, protocol mints staking rewards, then slashes a portion
/// via `burn_from` if the player misbehaves.
#[test]
fn sim_staking_reward_and_slash() {
    let (e, client, admin) = setup();
    let staker = Address::generate(&e);
    let protocol = Address::generate(&e);

    // Staker receives initial allocation
    let allocation: i128 = 10_000 * TYC;
    client.transfer(&admin, &staker, &allocation);

    // Staker approves protocol to slash up to 20 % of their balance
    let slash_allowance: i128 = allocation * 20 / 100;
    client.approve(&staker, &protocol, &slash_allowance, &0);

    // Protocol mints staking reward (5 %)
    let reward: i128 = allocation * 5 / 100;
    client.mint(&staker, &reward);
    assert_eq!(client.balance(&staker), allocation + reward);

    // Protocol slashes 10 % for misbehaviour
    let slash: i128 = allocation * 10 / 100;
    client.burn_from(&protocol, &staker, &slash);
    assert_eq!(client.balance(&staker), allocation + reward - slash);
    assert_eq!(client.allowance(&staker, &protocol), slash_allowance - slash);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + reward - slash);
}

// ── Scenario 9: supply deflation over multiple rounds ─────────────────────────

/// 5 game rounds each burn 2 % of the current total supply (simulated via
/// admin collecting and burning).  Verifies cumulative deflation and that
/// supply never goes negative.
#[test]
fn sim_supply_deflation_over_rounds() {
    let (e, client, admin) = setup();

    let burn_rate_num: i128 = 2;
    let burn_rate_den: i128 = 100;

    for _round in 0..5 {
        let supply = client.total_supply();
        let burn_amount = supply * burn_rate_num / burn_rate_den;
        // Admin holds enough since initial supply is minted to admin
        client.burn(&admin, &burn_amount);
        assert!(
            client.total_supply() < supply,
            "supply must decrease each round"
        );
        assert!(
            client.total_supply() >= 0,
            "supply must never go negative"
        );
    }

    // After 5 rounds the supply is strictly less than the initial supply
    assert!(client.total_supply() < INITIAL_SUPPLY);
}
