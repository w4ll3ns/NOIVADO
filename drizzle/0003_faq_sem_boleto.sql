-- Os presentes agora são pagos só com Pix ou cartão de crédito: corrige a resposta padrão da FAQ
-- (só quando ela ainda tem exatamente o texto de fábrica).
UPDATE "faqs" SET "answer" = replace("answer", '(Pix, cartão ou boleto)', '(Pix ou cartão de crédito)') WHERE "answer" LIKE '%(Pix, cartão ou boleto)%';
