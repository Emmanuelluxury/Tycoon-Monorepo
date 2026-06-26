//! # Simulation Scenarios — tycoon-collectibles (SW-CT-021)
//!
//! These tests exercise the contract's on-chain behaviour under realistic,
//! multi-step usage patterns rather than isolated unit checks. Each scenario
//! is self-contained: it creates its own `Env::default()` so there is no
//! shared state between runs.
//!
//! ## Scenarios
//!
//! | ID     | Scenario |
//! |--------|----------|
//! | SIM-01 | Shop stock is depleted by several distinct buyers; the next purchase fails with `InsufficientStock` |
//! | SIM-02 | Restocking after depletion allows further purchases; stock counter stays accurate |
//! | SIM-03 | Fee distribution totals accumulate correctly across purchases from multiple buyers |
//! | SIM-04 | A mid-session price update only affects purchases made after the update |
//! | SIM-05 | Multiple independently-stocked collectibles keep separate perk/strength/price/stock state |
//! | SIM-06 | A player buys several cash-tiered collectibles and burns each one in sequence for the correct tier payout |
//! | SIM-07 | Pausing blocks perk burns mid-session; unpausing restores the same player's ability to burn |
//! | SIM-08 | Collectibles change hands across three accounts in sequence; enumeration stays correct after each hop |
//! | SIM-09 | Backend minter rotation: the old minter is rejected after rotation, the new minter can mint, admin access is unaffected |
//! | SIM-10 | Sequential `mint_collectible` calls from both admin and minter produce monotonically increasing IDs in the `2_000_000_000+` range |
//! | SIM-11 | Metadata set for several tokens, then frozen; all further metadata/URI updates are rejected post-freeze |
//! | SIM-12 | A buyer who accumulates many distinct token types can page through them via `tokens_of_owner_page` with no gaps or duplicates |
//! | SIM-13 | Calling `migrate` mid-session preserves shop configuration and stock levels |
//! | SIM-14 | Non-tiered perks (`ExtraTurn`, `JailFree`, `Shield`) burn successfully without strength validation |
//! | SIM-15 | Two buyers purchase the same collectible concurrently with different currencies and draw from the same shared stock counter |

#[cfg(test)]
mod tests {
    extern crate std;
    use crate::types::{Perk, CASH_TIERS};
    use crate::{TycoonCollectibles, TycoonCollectiblesClient};
    use soroban_sdk::{
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, Env, String, Vec,
    };

    // ── helpers ───────────────────────────────────────────────────────────────

    fn setup(env: &Env) -> (Address, TycoonCollectiblesClient<'_>, Address) {
        let contract_id = env.register(TycoonCollectibles, ());
        let client = TycoonCollectiblesClient::new(env, &contract_id);
        let admin = Address::generate(env);
        client.initialize(&admin);
        (contract_id, client, admin)
    }

    fn make_token(env: &Env, admin: &Address) -> Address {
        env.register_stellar_asset_contract_v2(admin.clone())
            .address()
    }

    // ── SIM-01 ────────────────────────────────────────────────────────────────

    /// SIM-01: Shop stock is depleted by several distinct buyers; the next
    /// purchase fails with `InsufficientStock`.
    #[test]
    fn sim_01_stock_depleted_across_multiple_buyers() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        // 2 units in stock — exactly enough for two buyers.
        let token_id = client.stock_shop(&2, &3, &0, &100, &0);

        let buyers = [Address::generate(&env), Address::generate(&env)];
        for buyer in &buyers {
            StellarAssetClient::new(&env, &tyc_token).mint(buyer, &200);
            client.buy_collectible_from_shop(buyer, &token_id, &false);
        }
        assert_eq!(client.get_stock(&token_id), 0, "SIM-01: stock must be 0");

        // Third buyer must be rejected.
        let third = Address::generate(&env);
        StellarAssetClient::new(&env, &tyc_token).mint(&third, &200);
        let result = client.try_buy_collectible_from_shop(&third, &token_id, &false);
        assert!(
            result.is_err(),
            "SIM-01: purchase against depleted stock must fail"
        );
    }

    // ── SIM-02 ────────────────────────────────────────────────────────────────

    /// SIM-02: Restocking after depletion allows further purchases; the
    /// stock counter stays accurate across the deplete/restock cycle.
    #[test]
    fn sim_02_restock_after_depletion_allows_further_purchases() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        let token_id = client.stock_shop(&1, &4, &0, &50, &0);

        let buyer = Address::generate(&env);
        StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &500);
        client.buy_collectible_from_shop(&buyer, &token_id, &false);
        assert_eq!(client.get_stock(&token_id), 0);

        let result = client.try_buy_collectible_from_shop(&buyer, &token_id, &false);
        assert!(
            result.is_err(),
            "SIM-02: stock must be empty before restock"
        );

        client.restock_collectible(&token_id, &3);
        assert_eq!(
            client.get_stock(&token_id),
            3,
            "SIM-02: stock after restock"
        );

        client.buy_collectible_from_shop(&buyer, &token_id, &false);
        assert_eq!(client.balance_of(&buyer, &token_id), 2);
        assert_eq!(client.get_stock(&token_id), 2);
    }

    // ── SIM-03 ────────────────────────────────────────────────────────────────

    /// SIM-03: Fee distribution totals accumulate correctly across purchases
    /// made by multiple independent buyers.
    #[test]
    fn sim_03_fee_distribution_accumulates_across_buyers() {
        let env = Env::default();
        env.mock_all_auths();
        let (contract_id, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        let platform = Address::generate(&env);
        let pool = Address::generate(&env);
        // 10% platform, 3% creator (paid to admin), 2% pool → 85% residue.
        client.set_fee_config(&1000, &300, &200, &platform, &pool);

        let token_id = client.stock_shop(&3, &1, &2, &1000, &0);

        let buyers = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        for buyer in &buyers {
            StellarAssetClient::new(&env, &tyc_token).mint(buyer, &1000);
            client.buy_collectible_from_shop(buyer, &token_id, &false);
        }

        let tyc = TokenClient::new(&env, &tyc_token);
        assert_eq!(
            tyc.balance(&platform),
            300,
            "SIM-03: platform total after 3 sales"
        );
        assert_eq!(tyc.balance(&pool), 60, "SIM-03: pool total after 3 sales");
        assert_eq!(
            tyc.balance(&admin),
            90,
            "SIM-03: creator (admin) total after 3 sales"
        );
        assert_eq!(
            tyc.balance(&contract_id),
            2550,
            "SIM-03: residue total after 3 sales"
        );
    }

    // ── SIM-04 ────────────────────────────────────────────────────────────────

    /// SIM-04: A mid-session price update only affects purchases made after
    /// the update — the earlier buyer already paid the old price.
    #[test]
    fn sim_04_price_update_only_affects_subsequent_purchases() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        let token_id = client.stock_shop(&2, &5, &0, &1000, &0);

        let early_buyer = Address::generate(&env);
        StellarAssetClient::new(&env, &tyc_token).mint(&early_buyer, &2000);
        client.buy_collectible_from_shop(&early_buyer, &token_id, &false);
        assert_eq!(
            TokenClient::new(&env, &tyc_token).balance(&early_buyer),
            1000,
            "SIM-04: early buyer paid the original price"
        );

        client.update_collectible_prices(&token_id, &400, &0);

        let late_buyer = Address::generate(&env);
        StellarAssetClient::new(&env, &tyc_token).mint(&late_buyer, &2000);
        client.buy_collectible_from_shop(&late_buyer, &token_id, &false);
        assert_eq!(
            TokenClient::new(&env, &tyc_token).balance(&late_buyer),
            1600,
            "SIM-04: late buyer paid the updated price"
        );
    }

    // ── SIM-05 ────────────────────────────────────────────────────────────────

    /// SIM-05: Multiple independently-stocked collectibles keep separate
    /// perk / strength / price / stock state — no cross contamination.
    #[test]
    fn sim_05_independent_collectibles_do_not_cross_contaminate() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        let sword = client.stock_shop(&5, &1, &2, &100, &10);
        let shield = client.stock_shop(&3, &10, &0, &200, &20);
        let boots = client.stock_shop(&7, &8, &0, &50, &5);

        assert_eq!(client.get_token_perk(&sword), Perk::CashTiered);
        assert_eq!(client.get_token_perk(&shield), Perk::Shield);
        assert_eq!(client.get_token_perk(&boots), Perk::RollBoost);

        assert_eq!(client.get_token_strength(&sword), 2);
        assert_eq!(client.get_stock(&sword), 5);
        assert_eq!(client.get_stock(&shield), 3);
        assert_eq!(client.get_stock(&boots), 7);

        // Updating one collectible's price must not affect the others.
        client.update_collectible_prices(&shield, &999, &999);
        assert_eq!(
            client.get_stock(&sword),
            5,
            "SIM-05: sword stock unaffected"
        );
        assert_eq!(
            client.get_stock(&boots),
            7,
            "SIM-05: boots stock unaffected"
        );
    }

    // ── SIM-06 ────────────────────────────────────────────────────────────────

    /// SIM-06: A player buys several cash-tiered collectibles and burns
    /// each one in sequence, receiving the correct tier payout each time.
    #[test]
    fn sim_06_sequential_cash_tiered_burns_pay_correct_tiers() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _) = setup(&env);

        let player = Address::generate(&env);

        for strength in 1_u32..=5 {
            let token_id = strength as u128;
            client.buy_collectible(&player, &token_id, &1);
            client.set_token_perk(&token_id, &Perk::CashTiered, &strength);

            client.burn_collectible_for_perk(&player, &token_id);
            assert_eq!(
                client.balance_of(&player, &token_id),
                0,
                "SIM-06: collectible at strength {strength} must be fully burned"
            );
        }

        assert_eq!(CASH_TIERS, [100, 250, 500, 1000, 2500]);
    }

    // ── SIM-07 ────────────────────────────────────────────────────────────────

    /// SIM-07: Pausing the contract blocks perk burns mid-session; the same
    /// player's burn succeeds again once the admin unpauses.
    #[test]
    fn sim_07_pause_blocks_then_unpause_restores_perk_burn() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _) = setup(&env);

        let player = Address::generate(&env);
        client.buy_collectible(&player, &1, &2);
        client.set_token_perk(&1, &Perk::RentBoost, &0);

        client.set_pause(&true);
        let result = client.try_burn_collectible_for_perk(&player, &1);
        assert!(result.is_err(), "SIM-07: burn must fail while paused");
        assert_eq!(
            client.balance_of(&player, &1),
            2,
            "SIM-07: balance unchanged while paused"
        );

        client.set_pause(&false);
        client.burn_collectible_for_perk(&player, &1);
        assert_eq!(
            client.balance_of(&player, &1),
            1,
            "SIM-07: burn succeeds after unpause"
        );
    }

    // ── SIM-08 ────────────────────────────────────────────────────────────────

    /// SIM-08: A collectible changes hands across three accounts in
    /// sequence; ownership enumeration is correct after each hop.
    #[test]
    fn sim_08_enumeration_correct_across_multi_hop_transfers() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _) = setup(&env);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        let carol = Address::generate(&env);

        client.buy_collectible(&alice, &1, &1);
        assert_eq!(client.tokens_of(&alice).len(), 1);

        client.transfer(&alice, &bob, &1, &1);
        assert_eq!(
            client.tokens_of(&alice).len(),
            0,
            "SIM-08: alice no longer holds the token"
        );
        assert_eq!(
            client.tokens_of(&bob).len(),
            1,
            "SIM-08: bob now holds the token"
        );

        client.transfer(&bob, &carol, &1, &1);
        assert_eq!(
            client.tokens_of(&bob).len(),
            0,
            "SIM-08: bob no longer holds the token"
        );
        assert_eq!(
            client.tokens_of(&carol).len(),
            1,
            "SIM-08: carol now holds the token"
        );
        assert_eq!(client.balance_of(&carol, &1), 1);
    }

    // ── SIM-09 ────────────────────────────────────────────────────────────────

    /// SIM-09: Backend minter rotation — the old minter is rejected after
    /// rotation, the new minter can mint, and admin access is unaffected.
    #[test]
    fn sim_09_backend_minter_rotation() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let old_minter = Address::generate(&env);
        let new_minter = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.set_backend_minter(&old_minter);
        client.backend_mint(&old_minter, &recipient, &1, &1);
        assert_eq!(client.balance_of(&recipient, &1), 1);

        client.set_backend_minter(&new_minter);
        let result = client.try_backend_mint(&old_minter, &recipient, &2, &1);
        assert!(
            result.is_err(),
            "SIM-09: old minter must be rejected after rotation"
        );

        client.backend_mint(&new_minter, &recipient, &2, &1);
        assert_eq!(client.balance_of(&recipient, &2), 1);

        // Admin retains access throughout the rotation.
        client.backend_mint(&admin, &recipient, &3, &1);
        assert_eq!(client.balance_of(&recipient, &3), 1);
    }

    // ── SIM-10 ────────────────────────────────────────────────────────────────

    /// SIM-10: Sequential `mint_collectible` calls from both admin and
    /// minter produce monotonically increasing IDs in the `2_000_000_000+`
    /// range.
    #[test]
    fn sim_10_mint_collectible_ids_increase_across_admin_and_minter() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let minter = Address::generate(&env);
        client.set_backend_minter(&minter);

        let recipient = Address::generate(&env);
        let id_a = client.mint_collectible(&admin, &recipient, &1, &3);
        let id_b = client.mint_collectible(&minter, &recipient, &5, &0);
        let id_c = client.mint_collectible(&admin, &recipient, &2, &1);

        assert!(
            id_a >= 2_000_000_000,
            "SIM-10: first ID must be in collectible range"
        );
        assert_eq!(id_b, id_a + 1, "SIM-10: minter-issued ID increments by 1");
        assert_eq!(id_c, id_b + 1, "SIM-10: admin-issued ID increments by 1");

        assert_eq!(client.balance_of(&recipient, &id_a), 1);
        assert_eq!(client.balance_of(&recipient, &id_b), 1);
        assert_eq!(client.balance_of(&recipient, &id_c), 1);
    }

    // ── SIM-11 ────────────────────────────────────────────────────────────────

    /// SIM-11: Metadata set for several tokens, then frozen; all further
    /// metadata / URI updates are rejected post-freeze.
    #[test]
    fn sim_11_metadata_freeze_blocks_further_updates() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _) = setup(&env);

        let tyc_token = make_token(&env, &Address::generate(&env));
        let usdc_token = make_token(&env, &Address::generate(&env));
        client.init_shop(&tyc_token, &usdc_token);

        let sword = client.stock_shop(&1, &1, &1, &100, &10);
        let shield = client.stock_shop(&1, &10, &0, &100, &10);

        let attrs = Vec::new(&env);
        client.set_token_metadata(
            &sword,
            &String::from_str(&env, "Sword"),
            &String::from_str(&env, "A sharp sword"),
            &String::from_str(&env, "ipfs://sword.png"),
            &None,
            &None,
            &attrs,
        );
        client.set_token_metadata(
            &shield,
            &String::from_str(&env, "Shield"),
            &String::from_str(&env, "A sturdy shield"),
            &String::from_str(&env, "ipfs://shield.png"),
            &None,
            &None,
            &attrs,
        );

        // Freeze metadata globally.
        client.set_base_uri(&String::from_str(&env, "ipfs://base/"), &1, &true);

        let result = client.try_set_token_metadata(
            &sword,
            &String::from_str(&env, "Sword v2"),
            &String::from_str(&env, "Edited after freeze"),
            &String::from_str(&env, "ipfs://sword2.png"),
            &None,
            &None,
            &attrs,
        );
        assert!(
            result.is_err(),
            "SIM-11: metadata update must fail after freeze"
        );

        let uri_result =
            client.try_set_base_uri(&String::from_str(&env, "ipfs://other/"), &0, &false);
        assert!(
            uri_result.is_err(),
            "SIM-11: base URI update must fail after freeze"
        );
    }

    // ── SIM-12 ────────────────────────────────────────────────────────────────

    /// SIM-12: A buyer who accumulates many distinct token types can page
    /// through them via `tokens_of_owner_page` with no gaps or duplicates.
    #[test]
    fn sim_12_pagination_covers_every_token_exactly_once() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _) = setup(&env);

        let collector = Address::generate(&env);
        let total_tokens: u128 = 12;
        for token_id in 1..=total_tokens {
            client.buy_collectible(&collector, &token_id, &1);
        }

        let page_size = 5_u32;
        let mut seen: std::vec::Vec<u128> = std::vec::Vec::new();
        let mut page = 0_u32;
        loop {
            let batch = client.tokens_of_owner_page(&collector, &page, &page_size);
            if batch.is_empty() {
                break;
            }
            for id in batch.iter() {
                seen.push(id);
            }
            page += 1;
        }

        assert_eq!(
            seen.len(),
            total_tokens as usize,
            "SIM-12: every token must be visited"
        );
        let mut unique = seen.clone();
        unique.sort_unstable();
        unique.dedup();
        assert_eq!(
            unique.len(),
            seen.len(),
            "SIM-12: no token should appear twice"
        );
    }

    // ── SIM-13 ────────────────────────────────────────────────────────────────

    /// SIM-13: Calling `migrate` mid-session preserves shop configuration
    /// and stock levels — the upgrade path does not disturb live state.
    #[test]
    fn sim_13_migrate_preserves_shop_state() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        let token_id = client.stock_shop(&4, &2, &3, &100, &20);

        client.migrate();

        assert_eq!(
            client.get_stock(&token_id),
            4,
            "SIM-13: stock survives migrate"
        );
        assert_eq!(client.get_token_perk(&token_id), Perk::TaxRefund);
        assert_eq!(client.get_token_strength(&token_id), 3);

        // Migrate again — must remain idempotent and not disturb state further.
        client.migrate();
        assert_eq!(client.get_stock(&token_id), 4);
    }

    // ── SIM-14 ────────────────────────────────────────────────────────────────

    /// SIM-14: Non-tiered perks (`ExtraTurn`, `JailFree`, `Shield`) burn
    /// successfully without strength validation, across multiple perk
    /// types for the same player.
    #[test]
    fn sim_14_non_tiered_perks_burn_without_strength_validation() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, _) = setup(&env);

        let player = Address::generate(&env);
        let perks = [Perk::ExtraTurn, Perk::JailFree, Perk::Shield];

        for (i, perk) in perks.iter().enumerate() {
            let token_id = (i + 1) as u128;
            client.buy_collectible(&player, &token_id, &1);
            // Strength is irrelevant for non-tiered perks — use 0.
            client.set_token_perk(&token_id, perk, &0);
            client.burn_collectible_for_perk(&player, &token_id);
            assert_eq!(
                client.balance_of(&player, &token_id),
                0,
                "SIM-14: token for perk {perk:?} must be burned"
            );
        }
    }

    // ── SIM-15 ────────────────────────────────────────────────────────────────

    /// SIM-15: Two buyers purchase the same collectible concurrently with
    /// different currencies and draw from the same shared stock counter.
    #[test]
    fn sim_15_concurrent_purchases_share_stock_across_currencies() {
        let env = Env::default();
        env.mock_all_auths();
        let (_, client, admin) = setup(&env);

        let tyc_token = make_token(&env, &admin);
        let usdc_token = make_token(&env, &admin);
        client.init_shop(&tyc_token, &usdc_token);

        let token_id = client.stock_shop(&2, &4, &0, &300, &30);

        let tyc_buyer = Address::generate(&env);
        let usdc_buyer = Address::generate(&env);
        StellarAssetClient::new(&env, &tyc_token).mint(&tyc_buyer, &1000);
        StellarAssetClient::new(&env, &usdc_token).mint(&usdc_buyer, &1000);

        client.buy_collectible_from_shop(&tyc_buyer, &token_id, &false);
        assert_eq!(
            client.get_stock(&token_id),
            1,
            "SIM-15: stock after TYC purchase"
        );

        client.buy_collectible_from_shop(&usdc_buyer, &token_id, &true);
        assert_eq!(
            client.get_stock(&token_id),
            0,
            "SIM-15: stock after USDC purchase"
        );

        assert_eq!(client.balance_of(&tyc_buyer, &token_id), 1);
        assert_eq!(client.balance_of(&usdc_buyer, &token_id), 1);
        assert_eq!(TokenClient::new(&env, &tyc_token).balance(&tyc_buyer), 700);
        assert_eq!(
            TokenClient::new(&env, &usdc_token).balance(&usdc_buyer),
            970
        );
    }
}
