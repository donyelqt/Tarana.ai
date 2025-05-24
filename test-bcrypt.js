const bcrypt = require('bcryptjs');

async function testBcrypt() {
  const password = 'taranaai123';
  
  // Generate a fresh hash
  const newHash = await bcrypt.hash(password, 10);
  console.log('New hash:', newHash);
  
  // Test the new hash
  const isValid = await bcrypt.compare(password, newHash);
  console.log('New hash verification:', isValid);
  
  // Test the current hash in the file
  const currentHash = '$2b$10$w.1vkZvx.7gGcZPKtxve0.ceChlUAFiwWICmOsXerEoZRa/allY2y';
  const isCurrentValid = await bcrypt.compare(password, currentHash);
  console.log('Current hash verification:', isCurrentValid);
}

testBcrypt().catch(console.error);