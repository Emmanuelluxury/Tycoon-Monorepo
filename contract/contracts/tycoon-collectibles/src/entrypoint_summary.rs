//! SW-CT-024: Entrypoint classification summary — tycoon-collectibles
//!
//! This module is documentation-only (no runtime code). It provides a
//! machine-readable catalogue of every public entrypoint on
//! [`TycoonCollectibles`], annotated with:
//!
//! * **Access tier** — `ADMIN_ONLY`, `CALLER_AUTH`, `DUAL_ROLE`, or `PUBLIC_READ`
//! * **Auth check** — the exact `require_auth` call that guards the entrypoint
//! * **Error code** — the [`CollectibleError`] variant returned on auth failure
//!
//! The canonical prose version lives in `ENTRYPOINTS.md` at the crate root.
//! Keep the two files in sync whenever a new entrypoint is added or removed.
//!
//! # Access Tier Definitions
//!
//! | Tier | Description |
//! |------|-------------|
//! | `ADMIN_ONLY` | Requires the stored admin address to authorize the call |
//! | `CALLER_AUTH` | Requires the *caller* parameter to authorize the call |
//! | `DUAL_ROLE` | Accepts either the admin or the designated backend minter |
//! | `PUBLIC_READ` | No authorization required; safe to call from any context |

/// Marker constant — exported so external tooling can locate this module.
pub const ENTRYPOINT_SUMMARY_VERSION: u32 = 1;

// ── Access tier labels ────────────────────────────────────────────────────────

/// Entrypoint tier: caller must be the stored admin.
pub const ADMIN_ONLY: &str = "admin-only";

/// Entrypoint tier: caller must authorize via their own address.
pub const CALLER_AUTH: &str = "caller-auth";

/// Entrypoint tier: caller must be admin **or** the designated backend minter.
pub const DUAL_ROLE: &str = "dual-role (admin or backend-minter)";

/// Entrypoint tier: no authorization required.
pub const PUBLIC_READ: &str = "public-read";

// ── Entrypoint catalogue (documentation only) ─────────────────────────────────

/// Documentation struct that describes a single contract entrypoint.
///
/// Only used at compile time (in doc comments and tests).  No instance is
/// ever constructed at runtime.
#[allow(dead_code)]
pub struct EntrypointMeta {
    /// Soroban function name as it appears on-chain.
    pub name: &'static str,
    /// One of the tier constants defined above.
    pub tier: &'static str,
    /// The `require_auth` call pattern used.
    pub auth_pattern: &'static str,
    /// Error returned if authorization fails (empty string = panics or unreachable).
    pub auth_failure_error: &'static str,
}

/// All entrypoints of [`TycoonCollectibles`], keyed by position.
///
/// This array is the machine-readable source of truth for the entrypoint
/// classification table.  It is validated by [`tests::all_admin_entries_have_auth`].
pub const ENTRYPOINTS: &[EntrypointMeta] = &[
    // ── Admin-Only ────────────────────────────────────────────────────────────
    EntrypointMeta {
        name: "initialize",
        tier: ADMIN_ONLY,
        auth_pattern: "caller-supplied admin.require_auth()",
        auth_failure_error: "AlreadyInitialized (on re-call)",
    },
    EntrypointMeta {
        name: "migrate",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "init_shop",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "set_fee_config",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "stock_shop",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "restock_collectible",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "update_collectible_prices",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "set_collectible_for_sale",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "set_token_perk",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "set_pause",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "set_backend_minter",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "set_base_uri",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized / MetadataFrozen",
    },
    EntrypointMeta {
        name: "set_token_metadata",
        tier: ADMIN_ONLY,
        auth_pattern: "get_admin(&env).require_auth()",
        auth_failure_error: "Unauthorized / MetadataFrozen",
    },
    // ── Caller-Authenticated ──────────────────────────────────────────────────
    EntrypointMeta {
        name: "buy_collectible_from_shop",
        tier: CALLER_AUTH,
        auth_pattern: "buyer.require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "buy_collectible",
        tier: CALLER_AUTH,
        auth_pattern: "buyer.require_auth()",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "transfer",
        tier: CALLER_AUTH,
        auth_pattern: "from.require_auth()",
        auth_failure_error: "InsufficientBalance",
    },
    EntrypointMeta {
        name: "burn",
        tier: CALLER_AUTH,
        auth_pattern: "owner.require_auth()",
        auth_failure_error: "InsufficientBalance",
    },
    EntrypointMeta {
        name: "burn_collectible_for_perk",
        tier: CALLER_AUTH,
        auth_pattern: "caller.require_auth()",
        auth_failure_error: "ContractPaused / InsufficientBalance / InvalidPerk",
    },
    // ── Dual-Role ─────────────────────────────────────────────────────────────
    EntrypointMeta {
        name: "backend_mint",
        tier: DUAL_ROLE,
        auth_pattern: "caller.require_auth() + caller == admin || caller == minter",
        auth_failure_error: "Unauthorized",
    },
    EntrypointMeta {
        name: "mint_collectible",
        tier: DUAL_ROLE,
        auth_pattern: "caller.require_auth() + caller == admin || caller == minter",
        auth_failure_error: "Unauthorized",
    },
    // ── Public Read-Only ──────────────────────────────────────────────────────
    EntrypointMeta {
        name: "balance_of",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "tokens_of",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "get_backend_minter",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "get_stock",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "is_contract_paused",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "get_token_perk",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "get_token_strength",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "owned_token_count",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "token_of_owner_by_index",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "tokens_of_owner_page",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "iterate_owned_tokens",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "max_page_size",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "base_uri_config",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "token_metadata",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "token_uri",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
    EntrypointMeta {
        name: "is_metadata_frozen",
        tier: PUBLIC_READ,
        auth_pattern: "none",
        auth_failure_error: "",
    },
];

// ── Compile-time sanity checks ────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Every admin-only entry must name the correct auth pattern.
    #[test]
    fn all_admin_entries_have_require_auth() {
        for ep in ENTRYPOINTS {
            if ep.tier == ADMIN_ONLY {
                assert!(
                    ep.auth_pattern.contains("require_auth"),
                    "Admin-only entrypoint '{}' missing require_auth annotation",
                    ep.name
                );
            }
        }
    }

    /// Every public-read entry must have no auth pattern.
    #[test]
    fn all_public_read_entries_have_no_auth() {
        for ep in ENTRYPOINTS {
            if ep.tier == PUBLIC_READ {
                assert_eq!(
                    ep.auth_pattern, "none",
                    "Public-read entrypoint '{}' has unexpected auth pattern: {}",
                    ep.name, ep.auth_pattern
                );
            }
        }
    }

    /// Total entrypoint count must match the ENTRYPOINTS.md catalogue.
    /// Update this constant when entrypoints are added or removed.
    #[test]
    fn entrypoint_count_matches_documentation() {
        // 13 admin-only + 5 caller-auth + 2 dual-role + 16 public-read = 36
        assert_eq!(ENTRYPOINTS.len(), 36, "Entrypoint count changed — update ENTRYPOINTS.md");
    }

    /// Every entrypoint name must be non-empty and unique.
    #[test]
    fn entrypoint_names_are_unique_and_non_empty() {
        extern crate std;
        let mut seen = std::collections::HashSet::new();
        for ep in ENTRYPOINTS {
            assert!(!ep.name.is_empty(), "Empty entrypoint name found");
            assert!(
                seen.insert(ep.name),
                "Duplicate entrypoint name: '{}'",
                ep.name
            );
        }
    }

    /// Admin-only count matches what ENTRYPOINTS.md documents (13).
    #[test]
    fn admin_only_count() {
        let count = ENTRYPOINTS.iter().filter(|e| e.tier == ADMIN_ONLY).count();
        assert_eq!(count, 13, "Admin-only entrypoint count changed");
    }

    /// Caller-auth count matches what ENTRYPOINTS.md documents (5).
    #[test]
    fn caller_auth_count() {
        let count = ENTRYPOINTS.iter().filter(|e| e.tier == CALLER_AUTH).count();
        assert_eq!(count, 5, "Caller-auth entrypoint count changed");
    }

    /// Dual-role count matches what ENTRYPOINTS.md documents (2).
    #[test]
    fn dual_role_count() {
        let count = ENTRYPOINTS.iter().filter(|e| e.tier == DUAL_ROLE).count();
        assert_eq!(count, 2, "Dual-role entrypoint count changed");
    }

    /// Public-read count matches what ENTRYPOINTS.md documents (16).
    #[test]
    fn public_read_count() {
        let count = ENTRYPOINTS.iter().filter(|e| e.tier == PUBLIC_READ).count();
        assert_eq!(count, 16, "Public-read entrypoint count changed");
    }
}
