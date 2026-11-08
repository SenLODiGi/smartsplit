import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function diagnose() {
  console.log('--- 1. Testing Auth User ---');
  // Attempt to sign in or sign up a test onboarding user
  const testEmail = `test_onboarding_${Date.now()}@example.com`;
  const testPass = 'Password123!';

  console.log(`Signing up test user: ${testEmail}`);
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: testEmail,
    password: testPass,
    options: {
      data: { name: 'Test Onboarding User' }
    }
  });

  if (signUpErr) {
    console.error('SignUp Error:', signUpErr.message);
  }

  const user = signUpData?.user;
  const session = signUpData?.session;
  console.log('User created:', user?.id, 'Session exists:', Boolean(session));

  if (!session) {
    console.log('Supabase requires email confirmation or no session returned on signUp!');
    // Let's try signing in existing user if any
    return;
  }

  console.log('--- 2. Checking Profile creation ---');
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  console.log('Profile exists:', profile, 'Error:', profErr?.message);

  if (!profile) {
    console.log('Attempting to create profile manually...');
    const { data: insProf, error: insProfErr } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: 'Test Onboarding User',
        full_name: 'Test Onboarding User'
      })
      .select()
      .maybeSingle();
    console.log('Manual profile insert result:', insProf, 'Error:', insProfErr?.message);
  }

  console.log('--- 3. Testing Group Insert ---');
  let { data: grp, error: grpErr } = await supabase
    .from('groups')
    .insert({
      name: 'Test Onboarding Group',
      currency: 'LKR',
      created_by: user.id
    })
    .select()
    .single();

  console.log('Group insert result:', grp, 'Error:', grpErr?.message);

  if (!grp) {
    console.error('Cannot proceed without group');
    return;
  }

  console.log('--- 4. Testing Group Members Insert (WITHOUT SELECT) ---');
  const { data: gmNoSel, error: gmNoSelErr } = await supabase
    .from('group_members')
    .insert({
      group_id: grp.id,
      user_id: user.id,
      role: 'admin'
    });

  console.log('Insert WITHOUT select Error:', gmNoSelErr);

  console.log('--- 4b. Testing Group Members Insert (WITH SELECT) ---');
  const { data: gmWithSel, error: gmWithSelErr } = await supabase
    .from('group_members')
    .insert({
      group_id: grp.id,
      user_id: user.id,
      role: 'admin'
    })
    .select();

  console.log('Insert WITH select Error:', gmWithSelErr);

  console.log('--- 5. Testing Helper Functions ---');
  const { data: isMemGid, error: errGid } = await supabase.rpc('is_group_member', { gid: grp.id });
  console.log('is_group_member(gid):', isMemGid, 'Err:', errGid?.message);

  const { data: isMemG_id, error: errG_id } = await supabase.rpc('is_group_member', { g_id: grp.id });
  console.log('is_group_member(g_id):', isMemG_id, 'Err:', errG_id?.message);

  const { data: isAdmGid, error: errAdmGid } = await supabase.rpc('is_group_admin', { gid: grp.id });
  console.log('is_group_admin(gid):', isAdmGid, 'Err:', errAdmGid?.message);

  const { data: isAdmG_id, error: errAdmG_id } = await supabase.rpc('is_group_admin', { g_id: grp.id });
  console.log('is_group_admin(g_id):', isAdmG_id, 'Err:', errAdmG_id?.message);
}

diagnose();
