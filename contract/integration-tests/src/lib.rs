// Cross-contract integration tests for the Tycoon smart contract suite (#411).
// Each module exercises a distinct cross-contract flow.
// All tests use an isolated Soroban Env — no shared state between tests.
#[cfg(test)]
mod fixture;
#[cfg(test)]
mod game_reward_flow;
#[cfg(test)]
mod game_token_flow;
// Stellar Wave (SW-CON-001): legacy entrypoint deprecation coverage
#[cfg(test)]
mod legacy_entrypoints;
#[cfg(test)]
mod multi_player_flow;
#[cfg(test)]
mod reward_transfer_flow;
// Stellar Wave (SW-CON-003): simulation scenarios
#[cfg(test)]
mod simulation_scenarios;
// Stellar Wave (SW-CON-005): deprecation path for legacy entrypoints
#[cfg(test)]
mod legacy_entrypoints;
#[cfg(test)]
mod boost_admin_flow;
mod boost_system_integration;
#[cfg(test)]
mod security_review_checklist;
mod token_reward_flow;
// SW-CT-038: unit / integration coverage
#[cfg(test)]
mod unit_coverage;
