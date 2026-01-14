import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME;

if (!uri) throw new Error('MONGODB_URI is not defined');
if (!dbName) throw new Error('MONGODB_DB_NAME is not defined');

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Extend global type for TypeScript
declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise!;
} else {
    client = new MongoClient(uri);
    clientPromise = client.connect();
}

export async function getDb() {
    const client = await clientPromise;
    return client.db(dbName);
}
