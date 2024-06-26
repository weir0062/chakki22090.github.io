const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');


const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: process.env.CLOUD_NAME, 
  api_key: process.env.API_KEY, 
  api_secret: process.env.API_SECRET 
});


app.use(session({
    secret: 'code',
    resave: false,
    saveUninitialized: true,
}));
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'Jim-blog-pictures',
    allowedFormats: ['jpg', 'png'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

const upload = multer({ storage: storage });

app.use(passport.initialize());
app.use(passport.session());

const MONGODB_URI = process.env.MONGO_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log("Connected to MongoDB!");
    })
    .catch(error => {
        console.log("error:", error.message);
    });
    
    app.get('/api/isUserLoggedIn', (req, res) => {
        if (req.isAuthenticated()) {
            res.json({ loggedIn: true });
        } else {
            res.json({ loggedIn: false });
        }
    });

 
const postSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    title: String,
    content: String,
    image: String,
    category: String
});

const Post = mongoose.model('Post', postSchema);

passport.use(new LocalStrategy(
    function(username, password, done) {
        if (username === 'Jim' && password === 'password') {
            return done(null, { id: 'user_id', name: 'Jim' });
        } else {
            return done(null, false, { message: 'Incorrect login details.' });
        }
    }
));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    if (id === 'user_id') {
        done(null, { id: 'user_id', name: 'Jim' });
    } else {
        done(new Error('User not found'));
    }
});


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(403).send('Not logged in');
}




app.post('/api/addpost',ensureAuthenticated, upload.single('postImage'), async (req, res) => {

     let imageUrl = null;
    
     if (req.file) { 
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.url;
        publicId = result.public_id; 
    }

    console.log("Attempting to add a post with data:", req.body);
    try {
        const newPost = new Post({
            _id: new mongoose.Types.ObjectId(),
            title: req.body.title,
            content: req.body.content,
            image: imageUrl,  
            category: req.body.category 
        });
        await newPost.save();
        res.json({ success: true, message: 'Post Added!' });
    } catch (err) {
        console.error("Error while adding post:", err);
        res.json({ success: false, message: err.message });
    }
});







app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find().sort({ _id: -1 });
        res.json({ success: true, posts });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});



app.delete('/api/deletepost/:postId',ensureAuthenticated, async (req, res) => {
    try {
        await Post.deleteOne({ _id: req.params.postId });
        res.status(200).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});




app.post('/api/editpost/:postId',ensureAuthenticated, upload.single('postImage'), async (req, res) => {
    const postId = req.params.postId;
    
    let imageUrl;
    if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path);
        imageUrl = result.url;
    } else if (req.body.removeImage === 'true') {
        imageUrl = null;
    } else {
        imageUrl = undefined;  
    }

    const updatedData = {};
    if (req.body.title) updatedData.title = req.body.title;
    if (req.body.content) updatedData.content = req.body.content;
    if (imageUrl !== undefined) updatedData.image = imageUrl;
    if (req.body.category) updatedData.category = req.body.category;

    try {
        await Post.findByIdAndUpdate(postId, updatedData);
        res.json({ success: true, message: 'Post Added!' });
    } catch (err) {
        console.error("Error updating post:", err);
        res.json({ success: false, message: 'Error: ' + err.message });
    }
});



app.get('/blog', async (req, res) => {
    try {
        const posts = await Post.find(); 
        if (req.isAuthenticated()) {
            res.render('blog_edit', { posts: posts, isUserLoggedIn: true });
        } else {
            res.render('blog', { posts: posts, isUserLoggedIn: false });  
        }
    } catch (error) {
        console.error("Error retrieving posts:", error);
        res.status(500).send('Server errir');
    }
    
});


app.get('/slogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});
app.get('/services', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/services.html'));
});
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/about.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});



app.post('/slogin', 
    passport.authenticate('local', { failureRedirect: '/slogin' }),
    function(req, res) {
        req.session.editMode = true; 
        res.redirect('/blog.html'); 
    }
);

app.get('/logout', function(req, res) {
    req.logout(() => {}); 
    req.session.editMode = false;
    res.redirect('/');
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/.`);
});
