const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  });
};



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oszsgbp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const tuneCollection = client.db("tuneTime").collection("info");
    const usersCollection = client.db("tuneTime").collection("users");
    const selectedClassesCollection = client.db("tuneTime").collection("selectedclasses");

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
      res.send({ token });
    });

    // verify admin

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'Forbidden access' });
      }
      next();
    };

    // Info API
    app.get('/info', async (req, res) => {
      const result = await tuneCollection.find().toArray();
      res.send(result);
    });

    // Users API - GET endpoint to fetch all users
    app.get('/users', verifyJWT,verifyAdmin,  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Users API - POST endpoint to add a new user
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'User already exists' });
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // PATCH endpoint to make a user an admin

    app.get('/users/admin/:email', verifyJWT, async (req, res)=>{
      const email = req.params.email;

      if(req.decoded.email !==email){
        res.send({admin:false})
      }

      const query = {email:email}
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role==='admin'}
      res.send(result);
    })

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      };

      try {
        const result = await usersCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount === 1) {
          res.send({ message: 'User updated to admin successfully', modifiedCount: result.modifiedCount });
        } else {
          res.status(404).send({ message: 'User not found or already an admin' });
        }
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send({ message: 'Failed to update user', error });
      }
    });

    // Selected Classes API - POST endpoint to add a selected class
    app.post('/selectedclasses', async (req, res) => {
      const selectedClass = req.body;
      const query = { id: selectedClass.id };
      const existingClass = await selectedClassesCollection.findOne(query);

      if (existingClass) {
        return res.status(400).send({ message: 'Class already selected' });
      }

      try {
        const result = await selectedClassesCollection.insertOne(selectedClass);
        res.send(result);
      } catch (error) {
        console.error("Error adding selected class:", error);
        res.status(500).send({ message: 'Failed to add class', error });
      }
    });

    // Selected Classes API - GET endpoint to fetch all selected classes
    app.get('/selectedclasses', async (req, res) => {
      const result = await selectedClassesCollection.find().toArray();
      res.send(result);
    });

    // Selected Classes API - DELETE endpoint to remove a selected class
    app.delete('/selectedclasses/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      try {
        const result = await selectedClassesCollection.deleteOne(filter);
        if (result.deletedCount === 1) {
          res.send({ message: 'Class deleted successfully' });
        } else {
          res.status(404).send({ message: 'Class not found' });
        }
      } catch (error) {
        console.error("Error deleting class:", error);
        res.status(500).send({ message: 'Failed to delete class', error });
      }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Optionally close the client
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('time-tune');
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
