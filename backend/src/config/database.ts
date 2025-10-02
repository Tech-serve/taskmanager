import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURL = process.env.MONGO_URL;
    if (!mongoURL) {
      throw new Error('MONGO_URL environment variable is not defined');
    }

    const dbName = process.env.DB_NAME || 'simplified_jira';
    await mongoose.connect(mongoURL, {
      dbName
    });
    console.log(`✅ MongoDB connected successfully to database: ${dbName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB error:', error);
});