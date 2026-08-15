UPDATE print_settings 
SET 
  primary_color = '#D4AF37',
  secondary_color = '#1a1a2e',
  accent_color = '#f0e6d2',
  table_header_bg_color = '#D4AF37',
  table_header_text_color = '#ffffff',
  table_border_color = '#e5e5e5',
  table_row_even_color = '#f8f9fa',
  table_row_odd_color = '#ffffff',
  table_text_color = '#000000',
  totals_box_bg_color = '#f8f9fa',
  totals_box_text_color = '#333333',
  summary_bg_color = '#f0e6d2',
  customer_section_bg_color = '#f8f9fa',
  customer_section_border_color = '#D4AF37'
WHERE document_type = 'account_statement';