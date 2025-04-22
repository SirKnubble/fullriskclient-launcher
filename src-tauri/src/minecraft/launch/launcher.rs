use std::path::PathBuf;
use std::process::Command;
use log::info;
use crate::error::Result;
use crate::minecraft::dto::piston_meta::PistonMeta;
use crate::config::{LAUNCHER_DIRECTORY, ProjectDirsExt};
use crate::minecraft::minecraft_auth::Credentials;
use crate::minecraft::ClasspathBuilder;
use crate::minecraft::GameArguments;
use crate::minecraft::JvmArguments;
use crate::state::state_manager::State;
use uuid::Uuid;

pub struct MinecraftLaunchParameters {
    pub main_class: String,
    pub additional_libraries: Vec<PathBuf>,
    pub additional_jvm_args: Vec<String>,
    pub additional_game_args: Vec<String>,
    pub custom_client_jar: Option<PathBuf>,
    pub old_minecraft_arguments: Option<String>,
    pub force_include_minecraft_jar: bool,
    pub profile_id: Uuid,
    pub memory_max_mb: u32,
}

impl MinecraftLaunchParameters {
    pub fn new(profile_id: Uuid, memory_max_mb: u32) -> Self {
        Self {
            main_class: String::new(),
            additional_libraries: Vec::new(),
            additional_jvm_args: Vec::new(),
            additional_game_args: Vec::new(),
            custom_client_jar: None,
            old_minecraft_arguments: None,
            force_include_minecraft_jar: false,
            profile_id,
            memory_max_mb,
        }
    }

    pub fn with_main_class(mut self, main_class: &str) -> Self {
        self.main_class = main_class.to_string();
        self
    }

    pub fn with_additional_libraries(mut self, libraries: Vec<PathBuf>) -> Self {
        self.additional_libraries = libraries;
        self
    }

    pub fn with_additional_jvm_args(mut self, args: Vec<String>) -> Self {
        self.additional_jvm_args = args;
        self
    }

    pub fn with_additional_game_args(mut self, args: Vec<String>) -> Self {
        self.additional_game_args = args;
        self
    }

    pub fn with_custom_client_jar(mut self, jar_path: PathBuf) -> Self {
        self.custom_client_jar = Some(jar_path);
        self
    }

    pub fn with_old_minecraft_arguments(mut self, args: Option<String>) -> Self {
        self.old_minecraft_arguments = args;
        self
    }

    pub fn with_force_include_minecraft_jar(mut self, force: bool) -> Self {
        self.force_include_minecraft_jar = force;
        self
    }

    pub fn with_memory_max_mb(mut self, memory: u32) -> Self {
        self.memory_max_mb = memory;
        self
    }
}

pub struct MinecraftLauncher {
    java_path: PathBuf,
    game_directory: PathBuf,
    credentials: Option<Credentials>,
}

impl MinecraftLauncher {
    pub fn new(java_path: PathBuf, game_directory: PathBuf, credentials: Option<Credentials>) -> Self {
        Self {
            java_path,
            game_directory,
            credentials,
        }
    }

    fn process_old_arguments(&self, minecraft_arguments: Option<String>, piston_meta: &PistonMeta) -> Option<Vec<String>> {
        minecraft_arguments.map(|args_string| {
            info!("\nProcessing old format arguments (with advanced splitting):");
            
            // 1. Create the helper to resolve variables
            let game_args_resolver = GameArguments::new(
                self.credentials.clone(),
                piston_meta.id.clone(),
                self.game_directory.clone(),
                piston_meta.version_type.clone(),
                piston_meta.asset_index.id.clone(),
            );
            
            // 2. Split the *original* string by whitespace
            let tokens = args_string.split_whitespace();
            
            // 3. Iterate and replace variables in each token
            let mut processed_args: Vec<String> = Vec::new();
            for token in tokens {
                // Use the resolver's method for each token
                processed_args.push(game_args_resolver.replace_variables(token));
            }
            
            info!("Processed old arguments: {:?}", processed_args);
            processed_args
        })
    }

    pub async fn launch(
        &self,
        piston_meta: &PistonMeta,
        params: MinecraftLaunchParameters,
    ) -> Result<()> {
        let state = State::get().await?;
        let process_manager = &state.process_manager;

        // Remove fetching the profile just for RAM
        // let profile = state.profile_manager.get_profile(params.profile_id).await?;
        // let settings = &profile.settings;

        // 2. Java-Befehl initialisieren
        let mut command = Command::new(&self.java_path);
        command.current_dir(&self.game_directory);
        
        // Define paths
        let natives_path = LAUNCHER_DIRECTORY.meta_dir().join("natives").join(&piston_meta.id);

        // Build classpath first as it's needed for JVM arguments
        let classpath = if let Some(client_jar) = params.custom_client_jar {
            ClasspathBuilder::new(&piston_meta.id)
                .add_additional_libraries(&params.additional_libraries, 1)
                .add_piston_libraries(&piston_meta.libraries)
                .set_custom_client_jar(client_jar)
                .build(params.force_include_minecraft_jar)
        } else {
            ClasspathBuilder::new(&piston_meta.id)
                .add_additional_libraries(&params.additional_libraries, 1)
                .add_piston_libraries(&piston_meta.libraries)
                .build(params.force_include_minecraft_jar)
        };

        // Create JVM arguments processor
        let jvm_args = JvmArguments::new(
            natives_path.clone(),
            "noriskclient-launcher".to_string(),
            "3.0.0".to_string(),
            classpath.clone(),
        );

        // Process and add JVM arguments
        info!("\nProcessing JVM arguments:");
        let mut has_classpath = false;
        let mut has_natives = false;
        
        if let Some(arguments) = &piston_meta.arguments {
            let processed_jvm_args = jvm_args.process_arguments(&arguments.jvm);
            for arg in &processed_jvm_args {
                command.arg(arg);
                if arg == "-cp" {
                    has_classpath = true;
                }
                if arg.starts_with("-Djava.library.path=") {
                    has_natives = true;
                }
            }
        }

        info!("Adding RAM JVM argument: -Xmx{}M", params.memory_max_mb);
        command.arg(format!("-Xmx{}M", params.memory_max_mb));

        // Add recommended GC flags
        command.arg("-XX:+UnlockExperimentalVMOptions");
        command.arg("-XX:+UseG1GC");

        // Add additional JVM arguments
        for arg in params.additional_jvm_args {
            command.arg(arg);
        }

        // Add classpath if not already set
        if !has_classpath {
            command
                .arg("-cp")
                .arg(&classpath);
        }

        // Add natives path if not already set
        if !has_natives {
            command.arg(format!("-Djava.library.path={}", natives_path.to_string_lossy().replace("\\", "/")));
        }

        // Add main class
        command.arg(&params.main_class);

        // Create game arguments processor
        let game_args = GameArguments::new(
            self.credentials.clone(),
            piston_meta.id.clone(),
            self.game_directory.clone(),
            piston_meta.version_type.clone(),
            piston_meta.asset_index.id.clone(),
        );

        // Process and add game arguments
        if let Some(arguments) = &piston_meta.arguments {
            let processed_args = game_args.process_arguments(&arguments.game);
            for arg in processed_args {
                command.arg(arg);
            }
        } else if let Some(processed_args) = self.process_old_arguments(params.old_minecraft_arguments, piston_meta) {
            for arg in processed_args {
                command.arg(arg);
            }
        }

        // Add additional game arguments
        for arg in params.additional_game_args {
            command.arg(arg);
        }

        info!("Executing command: {:?}", command);

        // Start the process using ProcessManager
        process_manager.start_process(params.profile_id, command).await?;

        Ok(())
    }
}