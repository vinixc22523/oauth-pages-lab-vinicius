-- Migration number: 0002
-- Acrescenta a turma do aluno na tabela notas.
ALTER TABEL notas ADD COLUMN turma TEXT;
