const crypto = require('crypto');

const ITER   = 150_000;         
const KEYLEN = 32;              
const DIGEST = 'sha256';

function deriveKey(pass, salt) {
  return crypto.pbkdf2Sync(pass, salt, ITER, KEYLEN, DIGEST);
}

function aesEncrypt(buf, password) {
  const salt = crypto.randomBytes(16);
  const key  = deriveKey(password, salt);
  const iv   = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc    = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag    = cipher.getAuthTag();

  return { iv, tag, enc, salt };           
}

function aesDecrypt({ iv, tag, enc, salt }, password) {
  const key = deriveKey(password, salt);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}


function generateRSA() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding : { format: 'der', type: 'spki'  },
    privateKeyEncoding: { format: 'der', type: 'pkcs8' }
  });
  return { pubDer: publicKey, privDer: privateKey };
}


function signBlob(privDer, data) {
  const keyObj = crypto.createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' });
  const sign   = crypto.createSign('sha256');
  sign.update(data);
  sign.end();
  return sign.sign(keyObj);                
}

module.exports = { aesEncrypt, aesDecrypt, generateRSA, signBlob };
