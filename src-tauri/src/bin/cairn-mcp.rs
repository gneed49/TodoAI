#[tokio::main]
async fn main() -> anyhow::Result<()> {
    cairn_lib::run_standalone_mcp().await
}
