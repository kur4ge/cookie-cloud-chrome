/**
 * SECP256K1 加密工具
 * 提供基于 secp256k1 曲线的密钥生成、加密和解密功能
 */

import * as elliptic from 'elliptic';
import * as CryptoJS from 'crypto-js';

// 初始化 secp256k1 曲线
const ec = new elliptic.ec('secp256k1');

/**
 * 密钥对接口
 */
export interface KeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * 生成 secp256k1 密钥对
 * @returns 包含私钥和公钥的对象
 */
export function generateKeyPair(): KeyPair {
  // 生成随机密钥对
  const keyPair = ec.genKeyPair();

  // 获取私钥（十六进制格式）
  const privateKey = keyPair.getPrivate('hex');

  // 获取公钥（十六进制格式，压缩形式）
  const publicKey = keyPair.getPublic(true, 'hex');

  return {
    privateKey,
    publicKey
  };
}

/**
 * 从私钥恢复密钥对
 * @param privateKey 私钥（十六进制字符串）
 * @returns 包含私钥和公钥的对象
 */
export function getKeyPairFromPrivateKey(privateKey: string): KeyPair {
  // 从私钥创建密钥对
  const keyPair = ec.keyFromPrivate(privateKey, 'hex');

  // 获取公钥（十六进制格式，压缩形式）
  const publicKey = keyPair.getPublic(true, 'hex');

  return {
    privateKey,
    publicKey
  };
}

/**
 * 使用公钥加密数据并用私钥签名
 * @param recipientPublicKey 接收者的公钥
 * @param senderPrivateKey 发送者的私钥（用于签名）
 * @param data 要加密的数据
 * @returns 加密并签名后的数据（JSON字符串）
 */
export function encryptAndSign(recipientPublicKey: string, senderPrivateKey: string, data: string): string {
  // 为当前加密会话生成临时密钥对
  const ephemeral = ec.genKeyPair();

  // 解析接收者的公钥
  const recipientPublic = ec.keyFromPublic(recipientPublicKey, 'hex');

  // 计算共享密钥
  const sharedSecret = ephemeral.derive(recipientPublic.getPublic());

  // 将共享密钥转换为十六进制字符串
  const sharedSecretKey = CryptoJS.enc.Hex.parse(sharedSecret.toString(16).padStart(64, '0'));

  // 使用共享密钥作为 AES 密钥来加密数据
  const encrypted = CryptoJS.AES.encrypt(data, sharedSecretKey, {
    // 取共享密钥的前16字节作为初始化向量
    iv: CryptoJS.lib.WordArray.create(sharedSecretKey.words.slice(0, 4)),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // 获取临时公钥（这需要与密文一起发送）
  const ephPubKey = ephemeral.getPublic(true, 'hex');

  // 创建要签名的数据（包含加密后的数据和临时公钥）
  const dataToSign = JSON.stringify({
    ephPubKey,
    data: encrypted.toString(),
  });

  // 使用发送者的私钥签名数据
  const signature = sign(senderPrivateKey, dataToSign);

  // 组合临时公钥、加密数据和签名
  return JSON.stringify({
    ephPubKey,
    data: encrypted.toString(),
    signature
  });
}



/**
 * 验证签名并解密数据
 * @param recipientPrivateKey 接收者的私钥（用于解密）
 * @param encryptedData 加密的数据（由encryptAndSign函数生成的JSON字符串）
 * @returns 解密后的原始数据，如果签名无效则抛出错误
 */
export function verifyAndDecrypt(recipientPrivateKey: string, senderPublicKey: string, encryptedData: string): string {
  // 解析加密数据
  const parsedData = JSON.parse(encryptedData);
  const { ephPubKey, data, signature } = parsedData;

  // 验证签名
  const dataToVerify = JSON.stringify({
    ephPubKey,
    data,
  });

  const isValid = verify(senderPublicKey, dataToVerify, signature);
  if (!isValid) {
    throw new Error('签名验证失败，数据可能被篡改或不是由声称的发送者发送');
  }

  // 从私钥创建密钥对
  const recipientKeyPair = ec.keyFromPrivate(recipientPrivateKey, 'hex');

  // 解析发送者的临时公钥
  const ephemeralPublic = ec.keyFromPublic(ephPubKey, 'hex');

  // 计算共享密钥（应该与加密时计算的相同）
  const sharedSecret = recipientKeyPair.derive(ephemeralPublic.getPublic());

  // 将共享密钥转换为十六进制字符串
  const sharedSecretKey = CryptoJS.enc.Hex.parse(sharedSecret.toString(16).padStart(64, '0'));

  // 使用共享密钥解密数据
  const decrypted = CryptoJS.AES.decrypt(
    data,
    sharedSecretKey,
    {
      iv: CryptoJS.lib.WordArray.create(sharedSecretKey.words.slice(0, 4)),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );

  // 将解密后的数据转换为字符串
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * 使用私钥签名数据
 * @param privateKey 签名者的私钥
 * @param data 要签名的数据
 * @returns 签名（十六进制字符串）
 */
export function sign(privateKey: string, data: string): string {
  // 从私钥创建密钥对
  const keyPair = ec.keyFromPrivate(privateKey, 'hex');

  // 计算数据的哈希值
  const hash = CryptoJS.SHA256(data).toString();

  // 签名哈希值
  const signature = keyPair.sign(hash);

  // 返回签名的DER编码，并转换为Base64
  const derHex = signature.toDER('hex');
  const derWordArray = CryptoJS.enc.Hex.parse(derHex);
  return CryptoJS.enc.Base64.stringify(derWordArray);
}

/**
 * 验证签名
 * @param publicKey 签名者的公钥
 * @param data 原始数据
 * @param signature 签名（十六进制字符串）
 * @returns 签名是否有效
 */
export function verify(publicKey: string, data: string, signature: string): boolean {
  // 从公钥创建密钥
  const key = ec.keyFromPublic(publicKey, 'hex');

  // 计算数据的哈希值
  const hash = CryptoJS.SHA256(data).toString();

  // 将Base64签名转换回十六进制格式
  const signatureWordArray = CryptoJS.enc.Base64.parse(signature);
  const signatureHex = CryptoJS.enc.Hex.stringify(signatureWordArray);

  // 验证签名
  return key.verify(hash, signatureHex);
}


/**
 * 使用多个公钥加密数据并用私钥签名
 * @param recipientPublicKeys 多个接收者的公钥数组
 * @param senderPrivateKey 发送者的私钥（用于签名）
 * @param data 要加密的数据
 * @returns 加密并签名后的数据（JSON字符串）
 */
export function encryptAndSignForMultipleRecipients(
  recipientPublicKeys: string[], 
  senderPrivateKey: string, 
  data: string
): string {
  // 为当前加密会话生成临时密钥对
  const ephemeral = ec.genKeyPair();
  
  // 获取临时公钥
  const ephPubKey = ephemeral.getPublic(true, 'hex');
  
  // 生成随机AES密钥
  const aesKey = CryptoJS.lib.WordArray.random(32); // 256位密钥
  
  // 使用AES密钥加密数据（只加密一次）
  const encrypted = CryptoJS.AES.encrypt(data, aesKey, {
    iv: CryptoJS.lib.WordArray.create(aesKey.words.slice(0, 4)) ,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
  
  // 为每个接收者加密AES密钥，使用MD5哈希作为键
  const shareKeys: Record<string, string> = {};
  
  recipientPublicKeys.forEach(publicKey => {
    // 解析接收者的公钥
    const recipientPublic = ec.keyFromPublic(publicKey, 'hex');
    
    // 计算共享密钥
    const sharedSecret = ephemeral.derive(recipientPublic.getPublic());
    
    // 将共享密钥转换为十六进制字符串
    const sharedSecretKey = CryptoJS.enc.Hex.parse(sharedSecret.toString(16).padStart(64, '0'));
    
    // 使用共享密钥加密AES密钥
    const encryptedKey = CryptoJS.AES.encrypt(
      aesKey,
      sharedSecretKey,
      {
        iv: CryptoJS.lib.WordArray.create(sharedSecretKey.words.slice(0, 4)),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.NoPadding,
      }
    ).toString();
    
    // 使用MD5哈希作为键，避免暴露公钥信息
    const keyHash = CryptoJS.MD5(ephPubKey + publicKey).toString();
    
    // 存储加密后的密钥，以哈希值为索引
    shareKeys[keyHash] = encryptedKey;
  });
  
  // 创建要签名的数据
  const dataToSign = JSON.stringify({
    ephPubKey,
    data: encrypted,
  });
  
  // 使用发送者的私钥签名数据
  const signature = sign(senderPrivateKey, dataToSign);
  
  // 组合临时公钥、加密数据、加密的密钥和签名
  return JSON.stringify({
    ephPubKey,
    data: encrypted,
    shareKeys,
    signature
  });
}

/**
 * 验证签名并解密多接收者加密数据
 * @param recipientPrivateKey 接收者的私钥（用于解密）
 * @param senderPublicKey 发送者的公钥（用于验证签名）
 * @param encryptedData 加密的数据（由encryptAndSignForMultipleRecipients函数生成的JSON字符串）
 * @returns 解密后的原始数据，如果签名无效则抛出错误
 */
export function verifyAndDecryptForMultipleRecipients(
  recipientPrivateKey: string,
  senderPublicKey: string,
  encryptedData: string
): string {
  // 从私钥派生公钥
  const recipientPublicKey = getKeyPairFromPrivateKey(recipientPrivateKey).publicKey;
  
  // 解析加密数据
  const parsedData = JSON.parse(encryptedData);
  const { ephPubKey, data, shareKeys, signature } = parsedData;
  
  // 验证签名
  const dataToVerify = JSON.stringify({
    ephPubKey,
    data
  });
  
  const isValid = verify(senderPublicKey, dataToVerify, signature);
  if (!isValid) {
    throw new Error('签名验证失败，数据可能被篡改或不是由声称的发送者发送');
  }
  
  // 计算接收者的密钥哈希
  const keyHash = CryptoJS.MD5(ephPubKey + recipientPublicKey).toString();
  
  // 检查当前接收者的哈希是否在加密密钥列表中
  if (!shareKeys[keyHash]) {
    throw new Error('当前接收者不在允许解密的列表中');
  }
  
  // 从私钥创建密钥对
  const recipientKeyPair = ec.keyFromPrivate(recipientPrivateKey, 'hex');
  
  // 解析发送者的临时公钥
  const ephemeralPublic = ec.keyFromPublic(ephPubKey, 'hex');
  
  // 计算共享密钥
  const sharedSecret = recipientKeyPair.derive(ephemeralPublic.getPublic());
  
  // 将共享密钥转换为十六进制字符串
  const sharedSecretKey = CryptoJS.enc.Hex.parse(sharedSecret.toString(16).padStart(64, '0'));
  
  // 解密AES密钥
  const decryptedKey = CryptoJS.AES.decrypt(
    shareKeys[keyHash],
    sharedSecretKey,
    {
      iv: CryptoJS.lib.WordArray.create(sharedSecretKey.words.slice(0, 4)),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.NoPadding
    }
  );
  
  // 使用解密后的AES密钥解密数据
  const decrypted = CryptoJS.AES.decrypt(
    data,
    decryptedKey,
    {
      iv: CryptoJS.lib.WordArray.create(decryptedKey.words.slice(0, 4)),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }
  );
  
  // 将解密后的数据转换为字符串
  return decrypted.toString(CryptoJS.enc.Utf8);
}
