// Verify Supabase Storage configuration
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://odsyoxopcvtgxylmnapk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kc3lveG9wY3Z0Z3h5bG1uYXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MTk1ODUsImV4cCI6MjA4MTk5NTU4NX0.zUaaMN52LZTivr6h-aKyBTQTKD0EFbypV58S5vttmVk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyStorage() {
  console.log('\n🗂️  Verifying Storage Bucket Configuration...\n');

  try {
    // Check bucket exists and is public
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      console.log('❌ Error listing buckets:', bucketError.message);
      return;
    }

    const assetsBucket = buckets.find(b => b.name === 'Assets');

    if (!assetsBucket) {
      console.log('❌ Assets bucket not found');
      return;
    }

    console.log(`✅ Bucket 'Assets' exists (${assetsBucket.public ? 'PUBLIC ✓' : 'PRIVATE ⚠️'})`);

    // List all files in root
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('Assets')
      .list('', { limit: 100 });

    if (rootError) {
      console.log('❌ Error listing root files:', rootError.message);
    } else {
      console.log('\n📁 Root Files:');
      rootFiles.forEach(file => {
        const icon = file.name.includes('.') ? '📄' : '📁';
        console.log(`  ${icon} ${file.name}`);
      });
    }

    // List team folder
    const { data: teamFiles, error: teamError } = await supabase.storage
      .from('Assets')
      .list('team', { limit: 100 });

    if (teamError) {
      console.log('\n❌ Error listing team folder:', teamError.message);
    } else {
      console.log('\n📁 team/ folder:');
      const requiredTeamFiles = ['unity.png', 'sage.png', 'spark.png', 'valor.png'];
      requiredTeamFiles.forEach(file => {
        const exists = teamFiles.some(f => f.name === file);
        console.log(`  ${exists ? '✅' : '❌'} ${file}`);
      });
    }

    // List levels folder
    const { data: levelFiles, error: levelError } = await supabase.storage
      .from('Assets')
      .list('levels', { limit: 100 });

    if (levelError) {
      console.log('\n❌ Error listing levels folder:', levelError.message);
    } else {
      console.log('\n📁 levels/ folder:');
      const requiredLevelFiles = [
        'Noob.png', 'Rookie.png', 'Challenger.png', 'Striker.png',
        'Warrior.png', 'Captain.png', 'Elite.png', 'Champion.png',
        'Legend.png', 'Apex.png'
      ];
      requiredLevelFiles.forEach(file => {
        const exists = levelFiles.some(f => f.name === file);
        console.log(`  ${exists ? '✅' : '❌'} ${file}`);
      });
    }

    // Test public URL generation
    console.log('\n🔗 Testing Public URLs:');
    const testFiles = [
      'FNFLogo.png',
      'team/unity.png',
      'levels/Noob.png'
    ];

    for (const file of testFiles) {
      const { data } = supabase.storage.from('Assets').getPublicUrl(file);
      console.log(`  ✅ ${file}`);
      console.log(`     ${data.publicUrl}`);
    }

  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
  }

  console.log('\n✅ Storage verification complete!\n');
}

verifyStorage();
