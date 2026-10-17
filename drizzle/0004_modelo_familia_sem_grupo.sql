-- Os convites importados de famílias numeradas levam o nome das pessoas ("Edson e Jordania"):
-- "Queremos muito a {{NOME_GRUPO}}" ficaria estranho. Ajusta o modelo de família
-- (só quando ele ainda tem exatamente o texto de fábrica).
UPDATE "whatsapp_templates" SET "body" = replace("body", 'Queremos muito a {{NOME_GRUPO}} ao nosso lado', 'Queremos muito vocês ao nosso lado') WHERE "body" LIKE '%Queremos muito a {{NOME_GRUPO}} ao nosso lado%';
