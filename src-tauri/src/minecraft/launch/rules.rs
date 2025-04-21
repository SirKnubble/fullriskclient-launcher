use crate::minecraft::dto::piston_meta::Rule;
use crate::utils::system_info::{Architecture, OperatingSystem, ARCHITECTURE, OS};
use log::info;

pub struct RuleProcessor;

impl RuleProcessor {
    pub fn should_apply_rule(rule: &Rule) -> bool {
        match rule.action.as_str() {
            "allow" => {
                let mut rule_applies = true;

                //Check OS-specific rules
                if let Some(os) = &rule.os {
                    let current_os = match OS {
                        OperatingSystem::WINDOWS => "windows",
                        OperatingSystem::LINUX => "linux",
                        OperatingSystem::OSX => "osx",
                        _ => return false,
                    };

                    if let Some(name) = &os.name {
                        info!("    OS check: required={}, current={}", name, current_os);
                        if name != current_os {
                            info!("    ❌ OS does not match, skipping rule");
                            rule_applies = false;
                        } else {
                            info!("    ✅ OS matches");
                        }
                    }

                    if let Some(arch) = &os.arch {
                        let current_arch = match ARCHITECTURE {
                            Architecture::X86 => "x86",
                            Architecture::X64 => "x64",
                            Architecture::ARM => "arm",
                            Architecture::AARCH64 => "aarch64",
                            _ => return false,
                        };

                        info!(
                            "    Arch check: required={}, current={}",
                            arch, current_arch
                        );
                        if arch != current_arch {
                            info!("    ❌ Architecture does not match, skipping rule");
                            rule_applies = false;
                        } else {
                            info!("    ✅ Architecture matches");
                        }
                    }
                }

                //Check features
                if let Some(features) = &rule.features {
                    info!("    Features check:");
                    if features.is_demo_user == Some(true) {
                        info!("      ❌ Demo user feature not supported");
                        rule_applies = false;
                    }
                    if features.has_custom_resolution == Some(true) {
                        info!("      ❌ Custom resolution feature not supported");
                        rule_applies = false;
                    }
                    if features.has_quick_plays_support == Some(true) {
                        info!("      ❌ QuickPlay support feature not supported");
                        rule_applies = false;
                    }
                    if features.is_quick_play_singleplayer == Some(true) {
                        info!("      ❌ QuickPlay singleplayer feature not supported");
                        rule_applies = false;
                    }
                    if features.is_quick_play_multiplayer == Some(true) {
                        info!("      ❌ QuickPlay multiplayer feature not supported");
                        rule_applies = false;
                    }
                    if features.is_quick_play_realms == Some(true) {
                        info!("      ❌ QuickPlay realms feature not supported");
                        rule_applies = false;
                    }
                }

                if rule_applies {
                    info!("    ✅ Rule accepted");
                }
                rule_applies
            }
            "disallow" => {
                let mut rule_applies = true;

                //Check OS-specific rules
                if let Some(os) = &rule.os {
                    let current_os = match OS {
                        OperatingSystem::WINDOWS => "windows",
                        OperatingSystem::LINUX => "linux",
                        OperatingSystem::OSX => "osx",
                        _ => return false,
                    };

                    if let Some(name) = &os.name {
                        info!("    OS check: required={}, current={}", name, current_os);
                        if name != current_os {
                            info!("    ❌ OS does not match, skipping rule");
                            rule_applies = false;
                        } else {
                            info!("    ✅ OS matches");
                        }
                    }

                    if let Some(arch) = &os.arch {
                        let current_arch = match ARCHITECTURE {
                            Architecture::X86 => "x86",
                            Architecture::X64 => "x64",
                            Architecture::ARM => "arm",
                            Architecture::AARCH64 => "aarch64",
                            _ => return false,
                        };

                        info!(
                            "    Arch check: required={}, current={}",
                            arch, current_arch
                        );
                        if arch != current_arch {
                            info!("    ❌ Architecture does not match, skipping rule");
                            rule_applies = false;
                        } else {
                            info!("    ✅ Architecture matches");
                        }
                    }
                }

                if rule_applies {
                    info!("    ❌ Rule rejected (disallow)");
                }
                !rule_applies
            }
            _ => {
                info!("    ❌ Unknown rule action: {}", rule.action);
                false
            }
        }
    }

    pub fn should_include_library(rules: &Option<Vec<Rule>>) -> bool {
        info!("\nChecking library rules");

        if let Some(rules) = rules {
            let mut should_include = false;

            for rule in rules {
                info!("  Rule: action={}", rule.action);
                if Self::should_apply_rule(rule) {
                    should_include = true;
                }
            }

            info!(
                "  Final decision: {}",
                if should_include {
                    "✅ INCLUDED"
                } else {
                    "❌ EXCLUDED"
                }
            );
            should_include
        } else {
            info!("  ✅ No rules found, including by default");
            true
        }
    }

    pub fn should_apply_argument(rules: &[Rule]) -> bool {
        info!("\nChecking argument rules");

        for rule in rules {
            info!("  Rule: action={}", rule.action);
            if !Self::should_apply_rule(rule) {
                return false;
            }
        }

        info!("  ✅ All rules accepted");
        true
    }
}
