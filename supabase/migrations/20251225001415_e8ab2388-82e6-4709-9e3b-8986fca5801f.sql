-- Create table for contract template settings
CREATE TABLE IF NOT EXISTS contract_template_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  background_url TEXT DEFAULT '/bgc1.svg',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default settings
INSERT INTO contract_template_settings (setting_key, setting_value, background_url)
VALUES ('default', '{
  "header": {"x": 2200, "y": 680, "fontSize": 52, "visible": true, "textAlign": "end"},
  "date": {"x": 300, "y": 680, "fontSize": 42, "visible": true, "textAlign": "start"},
  "firstParty": {"x": 2200, "y": 850, "fontSize": 38, "visible": true, "textAlign": "end"},
  "firstPartyData": {
    "companyName": "شركة الفارس الذهبي للدعاية والإعلان",
    "address": "طرابلس – طريق المطار، حي الزهور",
    "representative": "يمثلها السيد جمال أحمد زحيل (المدير العام)"
  },
  "secondParty": {"x": 2200, "y": 1050, "fontSize": 38, "visible": true, "textAlign": "end"},
  "termsStartX": 2280,
  "termsStartY": 1200,
  "termsWidth": 2000,
  "termsTextAlign": "end",
  "termsTitleWeight": "bold",
  "termsContentWeight": "normal",
  "termsSpacing": 40
}'::jsonb, '/bgc1.svg')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE contract_template_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Allow read for authenticated users" ON contract_template_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update for authenticated users" ON contract_template_settings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON contract_template_settings
  FOR INSERT TO authenticated WITH CHECK (true);