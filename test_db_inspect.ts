import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijhaxfmydhhibvrgdzjy.supabase.co';
const supabaseKey = 'sb_publishable_O70bmKs6wSxT5ku-llaccg_9DmoN47S';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPCs() {
  const rpcs = [
    'create_group_with_creator',
    'is_group_member',
    'is_group_admin',
    'add_group_member_guest'
  ];

  for (const r of rpcs) {
    const { data, error } = await supabase.rpc(r as any, {});
    console.log(`RPC ${r}:`, error?.message || 'EXISTS');
  }
}

testRPCs();
