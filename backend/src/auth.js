const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');


const SECRET_KEY = process.env.SECRET_KEY || 'change-me';
const ACCESS_TOKEN_EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '60', 10);


function hashPassword(password) {
const salt = bcrypt.genSaltSync(10);
return bcrypt.hashSync(password, salt);
}


function verifyPassword(password, passwordHash) {
return bcrypt.compareSync(password, passwordHash);
}


function createAccessToken(subject) {
const expiresIn = `${ACCESS_TOKEN_EXPIRE_MINUTES}m`;
return jwt.sign({ sub: subject }, SECRET_KEY, { expiresIn });
}


function decodeToken(token) {
    try {
        const payload = jwt.verify(token, SECRET_KEY);
        return payload.sub;
    } catch (e) {
        return null;
    }
}


module.exports = { hashPassword, verifyPassword, createAccessToken, decodeToken };