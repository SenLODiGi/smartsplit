import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ijhaxfmydhhibvrgdzjy.supabase.co';
const supabaseKey = 'sb_publishable_O70bmKs6wSxT5ku-llaccg_9DmoN47S';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfileInsert() {
  const dummyId = '11111111-1111-1111-1111-111111111111';
  const { data, error } = await supabase.from('profiles').insert({
    id: dummyId,
    full_name: 'Senith Test',
    email: 'senith_test@example.com'
  }).select();
  console.log('Insert dummy into profiles:', { data, error });
}

testProfileInsert();
