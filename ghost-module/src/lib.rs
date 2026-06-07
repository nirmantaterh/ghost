use spacetimedb::{table, reducer, ReducerContext, Table};

#[table(name = bot_state, public)]
pub struct BotState {
    #[primary_key]
    #[auto_inc]
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub health: f32,
    pub biome: String,
    pub tick: u32,
}

#[table(name = prediction_error, public)]
pub struct PredictionError {
    #[primary_key]
    #[auto_inc]
    pub id: u32,
    pub tick: u32,
    pub error_magnitude: f32,
    #[default(0.0)]
    pub px: f32,
    #[default(0.0)]
    pub py: f32,
    #[default(0.0)]
    pub pz: f32,
    #[default(0.0)]
    pub ax: f32,
    #[default(0.0)]
    pub ay: f32,
    #[default(0.0)]
    pub az: f32,
}

#[table(name = challenge, public)]
pub struct Challenge {
    #[primary_key]
    #[auto_inc]
    pub id: u32,
    pub challenge_type: String,
    pub triggered: bool,
}

#[reducer]
pub fn update_bot_state(ctx: &ReducerContext, x: f32, y: f32, z: f32, health: f32, biome: String, tick: u32) {
    ctx.db.bot_state().insert(BotState { id: 0, x, y, z, health, biome, tick });
}

#[reducer]
pub fn record_prediction(ctx: &ReducerContext, tick: u32, px: f32, py: f32, pz: f32, ax: f32, ay: f32, az: f32) {
    let error = ((ax-px).powi(2) + (ay-py).powi(2) + (az-pz).powi(2)).sqrt();
    ctx.db.prediction_error().insert(PredictionError { id: 0, tick, px, py, pz, ax, ay, az, error_magnitude: error });
}

#[reducer]
pub fn inject_challenge(ctx: &ReducerContext, challenge_type: String) {
    ctx.db.challenge().insert(Challenge { id: 0, challenge_type, triggered: false });
}
