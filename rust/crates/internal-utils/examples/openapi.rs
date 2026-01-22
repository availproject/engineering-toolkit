use axum::Json;
use serde::Serialize;
use utoipa::openapi::Info;
use utoipa_axum::{router::OpenApiRouter, routes};

#[tokio::main(flavor = "current_thread")]
async fn main() {
    // initialize tracing
    tracing_subscriber::fmt::init();

    let open_api_routers: OpenApiRouter = OpenApiRouter::new().routes(routes!(get_user));
    let mut a = open_api_routers.into_openapi();
    a.info = Info::default();
    let a = a.to_pretty_json().unwrap();
    println!("{}", a);
}

#[derive(utoipa::ToSchema, Serialize)]
struct User {
    id: u64,
    username: String,
}

#[utoipa::path(get, path = "/user", responses((status = OK, body = User)))]
async fn get_user() -> Json<User> {
    Json(User {
        id: 1,
        username: "".into(),
    })
}
