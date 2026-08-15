const url = "https://atqjaiebixuzomrfwilu.supabase.co/rest/v1/printed_invoices?select=id,customer_id,total_amount,invoice_type,included_in_contract";
const headers = {
  "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cWphaWViaXh1em9tcmZ3aWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTkxOTcsImV4cCI6MjA3Mjc3NTE5N30.OGAQFsAl1Eo1tmPZ93VZoSL5tO2FYZa_szeRvUmoj-4"
};

fetch(url, { headers })
  .then(res => res.json().then(data => ({ status: res.status, data })))
  .then(res => {
    console.log("Response status:", res.status);
    if (res.status !== 200) {
      console.error("Error response:", JSON.stringify(res.data, null, 2));
    } else {
      console.log("Printed Invoices returned count:", res.data.length);
      console.log("First few rows:", JSON.stringify(res.data.slice(0, 3), null, 2));
    }
  })
  .catch(err => console.error("Error:", err));
