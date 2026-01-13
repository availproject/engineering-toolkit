use std::error::Error;
use std::fs::File;

pub use opentelemetry;
pub use tracing;
pub use tracing::{debug, error, info, trace, warn};
pub use tracing_subscriber;
use tracing_subscriber::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

#[derive(Default)]
pub struct TracingBuilder {
    json: Option<bool>,
    stdout: Option<bool>,
    file: Option<String>,
}

impl TracingBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn simple_initialize() -> Result<(), Box<dyn Error + Send + Sync>> {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(EnvFilter::from_default_env())
            .try_init()
    }

    pub fn with_stdout(mut self, value: bool) -> Self {
        self.json = Some(value);
        self
    }

    pub fn with_json(mut self, value: bool) -> Self {
        self.json = Some(value);
        self
    }

    pub fn with_file(mut self, path: impl Into<String>) -> Self {
        self.file = Some(path.into());
        self
    }

    /// directory: "./logs",  file_name: "./log.txt"
    pub fn with_default_file(mut self) -> Self {
        self.file = Some("./log.txt".to_owned());
        self
    }

    pub fn try_init(self) -> Result<(), Box<dyn Error + Send + Sync>> {
        use tracing_subscriber::Layer;
        use tracing_subscriber::fmt::layer;

        let json = self.json.unwrap_or(true);
        let stdout = self.stdout.unwrap_or(true);
        let filter = EnvFilter::from_default_env();
        let mut layers = Vec::new();

        if let Some(file) = self.file {
            let file = File::create(&file)?;
            let layer = layer().with_writer(file);
            if json {
                layers.push(layer.json().with_filter(filter.clone()).boxed());
            } else {
                layers.push(layer.with_ansi(false).with_filter(filter.clone()).boxed());
            }
        };

        if stdout {
            let layer = layer().with_filter(filter);
            layers.push(layer.boxed());
        }

        tracing_subscriber::registry()
            .with(layers)
            .try_init()
            .map_err(|e| e.into())
    }
}

#[cfg(test)]
pub mod test {
    use std::thread::sleep;

    use crate::{TracingBuilder, debug, error, info, trace, warn};

    #[test]
    pub fn tracing_works() {
        unsafe {
            std::env::set_var("RUST_LOG", "trace");
        }

        TracingBuilder::new()
            .with_default_file()
            .with_json(false)
            .try_init()
            .unwrap();
        trace!(target: "test", "Trace");
        info!(target: "test", "Info");
        warn!(target: "test", "Warn");
        debug!(target: "test", "Debug");
        error!(target: "test", "Error");

        sleep(std::time::Duration::from_secs(5));
    }
}
