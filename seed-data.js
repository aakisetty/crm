// Seed script for Real Estate CRM
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require('uuid');

const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'realestatecrm';

const sampleLeads = [
  {
    id: uuidv4(),
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '(555) 123-4567',
    lead_type: 'buyer',
    preferences: {
      zipcode: '90210',
      min_price: '400000',
      max_price: '600000',
      bedrooms: '3',
      bathrooms: '2'
    },
    assigned_agent: 'Mike Rodriguez',
    tags: ['first-time-buyer', 'qualified'],
    status: 'active',
    ai_insights: 'High-potential buyer with clear preferences for Beverly Hills area. Budget range indicates strong purchasing power.',
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: uuidv4(),
    name: 'Robert Chen',
    email: 'robert.chen@email.com',
    phone: '(555) 987-6543',
    lead_type: 'seller',
    preferences: {
      zipcode: '10001',
      min_price: '800000',
      max_price: '1200000',
      bedrooms: '2',
      bathrooms: '2'
    },
    assigned_agent: 'Lisa Park',
    tags: ['luxury', 'urgent'],
    status: 'active',
    ai_insights: 'Luxury market seller with Manhattan property. High-value transaction potential.',
    created_at: new Date(Date.now() - 86400000), // 1 day ago
    updated_at: new Date()
  },
  {
    id: uuidv4(),
    name: 'Emily Davis',
    email: 'emily.davis@email.com',
    phone: '(555) 456-7890',
    lead_type: 'buyer',
    preferences: {
      zipcode: '33101',
      min_price: '300000',
      max_price: '450000',
      bedrooms: '2',
      bathrooms: '1.5'
    },
    assigned_agent: 'Carlos Martinez',
    tags: ['investor', 'cash-buyer'],
    status: 'active',
    ai_insights: 'Investment-focused buyer in Miami market. Cash position makes them highly competitive.',
    created_at: new Date(Date.now() - 172800000), // 2 days ago
    updated_at: new Date()
  },
  {
    id: uuidv4(),
    name: 'Michael Thompson',
    email: 'michael.thompson@email.com',
    phone: '(555) 789-0123',
    lead_type: 'buyer',
    preferences: {
      zipcode: '78701',
      min_price: '250000',
      max_price: '400000',
      bedrooms: '3',
      bathrooms: '2'
    },
    assigned_agent: 'Jennifer White',
    tags: ['relocating', 'family'],
    status: 'new',
    ai_insights: 'Family relocating to Austin. Looking for move-in ready properties with good schools.',
    created_at: new Date(Date.now() - 259200000), // 3 days ago
    updated_at: new Date()
  },
  {
    id: uuidv4(),
    name: 'Amanda Garcia',
    email: 'amanda.garcia@email.com',
    phone: '(555) 321-6547',
    lead_type: 'seller',
    preferences: {
      zipcode: '94102',
      min_price: '900000',
      max_price: '1300000',
      bedrooms: '3',
      bathrooms: '2.5'
    },
    assigned_agent: 'David Kim',
    tags: ['downsizing', 'senior'],
    status: 'active',
    ai_insights: 'Downsizing homeowner in San Francisco. Likely to move quickly once right property is found.',
    created_at: new Date(Date.now() - 345600000), // 4 days ago
    updated_at: new Date()
  }
];

async function seedDatabase() {
  let client;
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('Connected successfully to MongoDB');

    const db = client.db(DB_NAME);

    // Clear existing data
    console.log('Clearing existing leads...');
    await db.collection('leads').deleteMany({});

    // Insert sample leads
    console.log('Inserting sample leads...');
    await db.collection('leads').insertMany(sampleLeads);
    console.log(`Inserted ${sampleLeads.length} sample leads`);

    console.log('Database seeded successfully!');

    // Display summary
    const leadCount = await db.collection('leads').countDocuments();
    const buyerCount = await db.collection('leads').countDocuments({ lead_type: 'buyer' });
    const sellerCount = await db.collection('leads').countDocuments({ lead_type: 'seller' });

    console.log('\n=== SEED SUMMARY ===');
    console.log(`Total Leads: ${leadCount}`);
    console.log(`Buyers: ${buyerCount}`);
    console.log(`Sellers: ${sellerCount}`);
    console.log('===================\n');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the seed script
seedDatabase();