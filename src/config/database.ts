'use strict';

import mongoose from 'mongoose';

mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

// Connection to the database

const conectionDB = async () => {
  try {
    const db = await mongoose.connect(process.env.MONGO_URL as string, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const url = `${db.connection.host}:${db.connection.port}`;
    console.log(`Connection to the database success: ${url}`);
  } catch (err: any) {
    console.log(err.message);
  }
};

export default conectionDB;
