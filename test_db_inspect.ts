import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijhaxfmydhhibvrgdzjy.supabase.co';
const supabaseKey = 'sb_publishable_O70bmKs6wSxT5ku-llaccg_9DmoN47S';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testParamRPC() {
  const { data, error } = await supabase.rpc('create_group_with_creator', {
    p_name: 'test'
  });
  console.log('Result with p_name:', { data, error });
}

testParamRPC();
