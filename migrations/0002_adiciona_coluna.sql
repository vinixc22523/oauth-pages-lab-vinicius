-- Migration number: 0002
-- Acrescenta a turma do aluno na tabela notas.
ALTER TABLE notas ADD COLUMN turma TEXT;
