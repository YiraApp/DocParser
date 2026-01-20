import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI || !DB_NAME) {
    console.error('❌ Error: MONGODB_URI or MONGODB_DB_NAME not set in .env.local');
    process.exit(1);
}

async function initializeDatabase() {
    const client = new MongoClient(MONGODB_URI!);
    try {
        await client.connect();
        console.log('✓ Connected to MongoDB');
        console.log(`✓ Using database: ${DB_NAME}`);
        console.log(`✓ URI: ${MONGODB_URI!.split('@')[1]?.split('?')[0] || 'local'}`);
        const db = client.db(DB_NAME!);
        // Create collections with schema validation
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map((c) => c.name);
        // 1. Accounts Collection
        if (!collectionNames.includes('accounts')) {
            await db.createCollection('accounts', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['email', 'role', 'status'],
                        properties: {
                            _id: { bsonType: 'objectId' },
                            email: { bsonType: 'string' },
                            role: { enum: ['admin', 'user'] },
                            status: { enum: ['active', 'inactive', 'suspended'] },
                            created_at: { bsonType: 'date' },
                            updated_at: { bsonType: 'date' },
                            upload_limit: { bsonType: ['int', 'null'] },
                            upload_count: { bsonType: 'int' },
                            created_by: { bsonType: 'string' },
                        },
                    },
                },
            });
            console.log('✓ Created accounts collection');
            // Create unique index on email
            await db.collection('accounts').createIndex({ email: 1 }, { unique: true });
            console.log('✓ Created unique index on accounts.email');
        }
        // 2. Documents Collection
        if (!collectionNames.includes('documents')) {
            await db.createCollection('documents', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['user_email', 'file_name', 'status'],
                        properties: {
                            _id: { bsonType: 'objectId' },
                            user_email: { bsonType: 'string' },
                            file_name: { bsonType: 'string' },
                            file_type: { bsonType: 'string' },
                            file_size: { bsonType: 'int' },
                            file_data: { bsonType: 'string' }, // Base64 encoded
                            status: { enum: ['uploaded', 'processing', 'completed', 'failed'] },
                            created_at: { bsonType: 'date' },
                            updated_at: { bsonType: 'date' },
                            parsed_data: { bsonType: ['object', 'null'] },
                            structured_data: { bsonType: ['object', 'null'] },
                            webhook_processed: { bsonType: 'bool' },
                            job_id: { bsonType: ['string', 'null'] },
                            report_id: { bsonType: ['string', 'null'] },
                            error_message: { bsonType: ['string', 'null'] },
                            // In the documents collection validator, ensure fraud_detection field exists
                            fraud_detection: { bsonType: ['object', 'null'] },                        },
                    },
                },
            });
            console.log('✓ Created documents collection');
            // Create indexes
            await db.collection('documents').createIndex({ user_email: 1, created_at: -1 });
            await db.collection('documents').createIndex({ job_id: 1 });
            console.log('✓ Created indexes on documents');
        }
        // 3. Webhook Responses Collection
        if (!collectionNames.includes('webhook_responses')) {
            await db.createCollection('webhook_responses', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['job_id', 'status'],
                        properties: {
                            _id: { bsonType: 'objectId' },
                            job_id: { bsonType: 'string' },
                            report_id: { bsonType: ['string', 'null'] },
                            status: { bsonType: 'string' },
                            message: { bsonType: 'string' },
                            files_uploaded: { bsonType: 'int' },
                            total_size_mb: { bsonType: 'double' },
                            webhook_url: { bsonType: 'string' },
                            received_at: { bsonType: 'date' },
                            timestamp: { bsonType: 'string' },
                            processed: { bsonType: 'bool' },
                            document_id: { bsonType: ['objectId', 'null'] },
                            fraud_detection: { bsonType: ['object', 'null'] },
                        },
                    },
                },
            });
            console.log('✓ Created webhook_responses collection');
            // Create index on job_id
            await db.collection('webhook_responses').createIndex({ job_id: 1 });
            console.log('✓ Created indexes on webhook_responses');
        }
        // 4. Upload History Collection
        if (!collectionNames.includes('upload_history')) {
            await db.createCollection('upload_history', {
                validator: {
                    $jsonSchema: {
                        bsonType: 'object',
                        required: ['user_email', 'action'],
                        properties: {
                            _id: { bsonType: 'objectId' },
                            user_email: { bsonType: 'string' },
                            action: { enum: ['upload', 'delete', 'search'] },
                            document_id: { bsonType: ['objectId', 'null'] },
                            details: { bsonType: ['object', 'null'] },
                            created_at: { bsonType: 'date' },
                        },
                    },
                },
            });
            console.log('✓ Created upload_history collection');
            // Create index
            await db.collection('upload_history').createIndex({ user_email: 1, created_at: -1 });
            console.log('✓ Created indexes on upload_history');
        }
        console.log('\n✅ Database initialization complete!');
        console.log('\nCollections created:');
        console.log(' - accounts');
        console.log(' - documents');
        console.log(' - webhook_responses');
        console.log(' - upload_history');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
        process.exit(1);
    } finally {
        await client.close();
    }
}

initializeDatabase();