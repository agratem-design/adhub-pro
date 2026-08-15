-- Update default settings with correct positions from BillboardPrintIndividual
UPDATE billboard_print_settings 
SET elements = '{
  "contractNumber": {"visible": true, "top": "40mm", "right": "12mm", "fontSize": "14px", "fontWeight": "700", "color": "#000"},
  "adType": {"visible": true, "top": "40mm", "right": "35mm", "fontSize": "14px", "fontWeight": "700", "color": "#000"},
  "billboardName": {"visible": true, "top": "200px", "left": "16%", "fontSize": "20px", "fontWeight": "700", "color": "#111", "width": "450px", "textAlign": "center"},
  "size": {"visible": true, "top": "184px", "left": "63%", "fontSize": "35px", "fontWeight": "900", "color": "#000", "width": "300px", "textAlign": "center"},
  "facesCount": {"visible": true, "top": "220px", "left": "63%", "fontSize": "14px", "color": "#000", "width": "300px", "textAlign": "center"},
  "image": {"visible": true, "top": "340px", "left": "0", "width": "650px", "height": "350px", "borderWidth": "4px", "borderColor": "#000", "borderRadius": "0 0 10px 10px"},
  "locationInfo": {"visible": true, "top": "229mm", "left": "0", "fontSize": "21px", "fontWeight": "700", "width": "150mm", "color": "#000"},
  "landmarkInfo": {"visible": true, "top": "239mm", "left": "0", "fontSize": "21px", "fontWeight": "500", "width": "150mm", "color": "#000"},
  "qrCode": {"visible": true, "top": "970px", "left": "245px", "width": "100px", "height": "100px"},
  "designs": {"visible": true, "top": "700px", "left": "75px", "width": "640px", "height": "200px", "gap": "38px"},
  "installationDate": {"visible": true, "top": "42.869mm", "right": "116mm", "fontSize": "11px", "fontWeight": "400", "color": "#000"},
  "printType": {"visible": true, "top": "170px", "right": "83px", "fontSize": "18px", "color": "#d4af37", "fontWeight": "900"},
  "cutoutImage": {"visible": true, "top": "600px", "left": "75px", "width": "200px", "height": "200px", "borderWidth": "2px", "borderColor": "#000"},
  "faceAImage": {"visible": true, "top": "700px", "left": "75px", "width": "260px", "height": "159px", "borderWidth": "3px", "borderColor": "#ccc"},
  "faceBImage": {"visible": true, "top": "700px", "left": "380px", "width": "260px", "height": "159px", "borderWidth": "3px", "borderColor": "#ccc"}
}'::jsonb,
updated_at = now()
WHERE setting_key = 'default';