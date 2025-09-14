const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function validateIssues() {
  try {
    // Fetch unvalidated issues
    const { data: issues, error } = await supabase
      .from('issues')
      .select('id, description, image_url')
      .is('is_authentic', null);

    if (error) {
      console.error('Error fetching issues:', error);
      return;
    }

    if (!issues || issues.length === 0) {
      console.log('No unvalidated issues found.');
      return;
    }

    for (const issue of issues) {
      const { id, description, image_url } = issue;
      let category = 'other';
      let confidence = 0.2;
      let isSpam = false;

      // Check for spam
      if (!description || description.length < 10 || !image_url) {
        isSpam = true;
        confidence = 0.2;
      } else {
        // Keyword classification
        const descLower = description.toLowerCase(); 
        if (descLower.includes('pothole')) {
          category = 'pothole';
        } else if (descLower.includes('garbage') || descLower.includes('trash')) {
          category = 'garbage';
        } else if (descLower.includes('light')) {
          category = 'streetlight';
        } else if (descLower.includes('water') || descLower.includes('leak')) {
          category = 'water leakage';
        }

        // Assign confidence
        const hasKeyword = category !== 'other';
        if (hasKeyword && image_url) {
          confidence = 0.9;
        } else if (hasKeyword && !image_url) {
          confidence = 0.7;
        } else if (!hasKeyword && image_url) {
          confidence = 0.5;
        } else {
          confidence = 0.2;
        }
      }

      const isAuthentic = confidence > 0.75 && !isSpam;
      const aiDecision = isAuthentic ? 'authentic' : isSpam ? 'spam' : 'uncertain';

      // Update issue
      const { error: updateError } = await supabase
        .from('issues')
        .update({ is_authentic: isAuthentic, confidence, category })
        .eq('id', id);

      if (updateError) {
        console.error(`Error updating issue ${id}:`, updateError);
        continue;
      }

      // Insert audit
      const { error: auditError } = await supabase
        .from('issue_ai_audit')
        .insert({
          issue_id: id,  // Assuming id is UUID string
          ai_decision: aiDecision,
          confidence,
          category,
          model_used: 'keyword-based'
        });

      if (auditError) {
        console.error(`Error inserting audit for issue ${id}:`, auditError);
      }

      // Log
      const status = isAuthentic ? 'authentic' : isSpam ? 'spam' : 'uncertain';
      console.log(`✅ Processed issue ${id} → ${status} (${category})`);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

validateIssues();
