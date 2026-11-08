import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function inspect() {
  console.log('Testing Supabase connection...');
  const { data: expCols, error: expErr } = await supabase.from('expenses').select('*').limit(1);
  console.log('expenses error:', expErr?.message);
  console.log('expenses sample keys:', expCols && expCols[0] ? Object.keys(expCols[0]) : 'empty table or no rows');

  const { data: gmCols, error: gmErr } = await supabase.from('group_members').select('*').limit(1);
  console.log('group_members error:', gmErr?.message);
  console.log('group_members sample keys:', gmCols && gmCols[0] ? Object.keys(gmCols[0]) : 'empty table or no rows');

  const { data: esCols, error: esErr } = await supabase.from('expense_splits').select('*').limit(1);
  console.log('expense_splits error:', esErr?.message);
  console.log('expense_splits sample keys:', esCols && esCols[0] ? Object.keys(esCols[0]) : 'empty table or no rows');

  const { data: groups, error: grpErr } = await supabase.from('groups').select('*').limit(5);
  console.log('groups error:', grpErr?.message);
  console.log('groups:', groups?.map(g => ({ id: g.id, name: g.name, created_by: g.created_by })));
}

inspect();
