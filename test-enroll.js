import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    // Attempt standard insert
    const newStudent = {
        fullName: 'Test Enrollment Error',
        gamer_tag: 'testy',
        houseId: 'UNITY',
        gender: 'Male',
        deviceId: null,
        display_preference: 'FULL_NAME',
        avatarUrl: '/assets/avatars/default-boy.png',
        points: 0,
        hasWearable: false,
        rankId: 'r_noob',
        badges: '{}',
        inventory: '{}'
    };

    const { data, error } = await supabase
        .from('students')
        .insert([newStudent])
        .select()
        .single();

    if (error) {
        console.error("DB Insert Error:", error);
    } else {
        console.log("Success! Inserted student.", data);
        await supabase.from('students').delete().eq('id', data.id);
    }
}
test();
