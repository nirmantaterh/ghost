export class DbConnection {
  static builder() {
    return {
      withUri: () => ({ 
        withDatabaseName: () => ({ 
          onConnect: (cb: any) => { 
            setTimeout(() => cb(new MockDb()), 100);
            return { 
              onConnectError: () => ({ build: () => new MockDb() }) 
            } 
          } 
        }) 
      }),
      build: () => new MockDb()
    }
  }
}

class MockDb {
  async update_bot_state(x: number, y: number, z: number, health: number, biome: string, tick: number) {
    console.log(`[DB] Bot state: ${x}, ${y}, ${z}, tick ${tick}`);
  }

  async record_prediction(tick: number, px: number, py: number, pz: number, ax: number, ay: number, az: number) {
    console.log(`[DB] Prediction recorded`);
  }
}