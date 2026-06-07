use spacetimedb::{table, reducer, ReducerContext, Timestamp};

#[table(name = bot_state, public)]
pub struct BotState {
    #[primary_key]
    pub id: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub health: f32,
    pub biome: String,
    pub tick: u64,
    pub updated_at: Timestamp,
}

#[table(name = prediction_error, public)]
pub struct PredictionError {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub tick: u64,
    pub error_magnitude: f32,
    pub recorded_at: Timestamp,
}

#[table(name = challenge, public)]
pub struct Challenge {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub challenge_type: String,
    pub triggered: bool,
}

#[reducer]
pub fn update_bot_state(ctx: &ReducerContext, x: f32, y: f32, z: f32, health: f32, biome: String, tick: u64) {
    ctx.db.bot_state().insert(BotState { id: 0, x, y, z, health, biome, tick, updated_at: ctx.timestamp });
}

#[reducer]
pub fn record_prediction(ctx: &ReducerContext, tick: u64, px: f32, py: f32, pz: f32, ax: f32, ay: f32, az: f32) {
    let error = ((ax-px).powi(2) + (ay-py).powi(2) + (az-pz).powi(2)).sqrt();
    ctx.db.prediction_error().insert(PredictionError { id: 0, tick, error_magnitude: error, recorded_at: ctx.timestamp });
}

#[reducer]
pub fn inject_challenge(ctx: &ReducerContext, challenge_type: String) {
    ctx.db.challenge().insert(Challenge { id: 0, challenge_type, triggered: false });
}
