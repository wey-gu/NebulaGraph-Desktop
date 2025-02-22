const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs/promises');

const execAsync = promisify(exec);

const IMAGES = {
  graphd: {
    name: 'vesoft/nebula-graphd',
    tag: 'v3.8.0'
  },
  metad: {
    name: 'vesoft/nebula-metad',
    tag: 'v3.8.0'
  },
  storaged: {
    name: 'vesoft/nebula-storaged',
    tag: 'v3.8.0'
  },
  studio: {
    name: 'vesoft/nebula-graph-studio',
    tag: 'v3.10.0'
  },
  console: {
    name: 'vesoft/nebula-console',
    tag: 'nightly'
  }
};

const IMAGES_DIR = path.join('assets', 'NebulaGraph-Desktop', 'images');

async function getImageSize(image) {
  try {
    const { stdout } = await execAsync(`docker image ls ${image} --format "{{.Size}}"`);
    return stdout.trim();
  } catch (error) {
    console.error(`Failed to get size for ${image}:`, error);
    return 'unknown';
  }
}

async function generateChecksum(filePath) {
  try {
    const { stdout } = await execAsync(`shasum -a 256 "${filePath}"`);
    return stdout.split(' ')[0];
  } catch (error) {
    console.error(`Failed to generate checksum for ${filePath}:`, error);
    return 'unknown';
  }
}

async function main() {
  try {
    // Ensure images directory exists
    await fs.mkdir(IMAGES_DIR, { recursive: true });

    console.log('🐳 Preparing NebulaGraph Docker images...\n');

    const results = {};

    for (const [key, config] of Object.entries(IMAGES)) {
      const fullImageName = `${config.name}:${config.tag}`;
      console.log(`📥 Processing ${fullImageName}...`);

      try {
        // Pull image
        console.log(`   Pulling image...`);
        await execAsync(`docker pull ${fullImageName}`);

        // Get image size
        const size = await getImageSize(fullImageName);
        console.log(`   Image size: ${size}`);

        // Save image
        const tarFile = path.join(IMAGES_DIR, `${key}.tar`);
        console.log(`   Saving to ${tarFile}...`);
        await execAsync(`docker save -o "${tarFile}" ${fullImageName}`);

        // Generate checksum
        const checksum = await generateChecksum(tarFile);
        console.log(`   Checksum: ${checksum}`);

        results[key] = {
          ...config,
          size,
          checksum
        };

        console.log(`✅ Successfully processed ${fullImageName}\n`);
      } catch (error) {
        console.error(`❌ Failed to process ${fullImageName}:`, error);
        process.exit(1);
      }
    }

    // Generate manifest
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      images: results
    };

    const manifestPath = path.join(IMAGES_DIR, 'manifest.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    console.log('📝 Generated manifest:', manifestPath);
    console.log('\n✨ All images prepared successfully!');
    
    // Print summary
    console.log('\n📊 Summary:');
    for (const [key, config] of Object.entries(results)) {
      console.log(`   ${key}: ${config.name}:${config.tag} (${config.size})`);
    }
  } catch (error) {
    console.error('❌ Failed to prepare images:', error);
    process.exit(1);
  }
}

main().catch(console.error); 