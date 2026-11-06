-- Removes the Figma integration: connection, OAuth state, imported files, import jobs and saved section mappings.
-- Installed pages, design systems, fonts and assets are kept. Row level security policies drop with their tables.
DROP TABLE IF EXISTS "SectionMapping";
DROP TABLE IF EXISTS "DesignImport";
DROP TABLE IF EXISTS "FigmaFile";
DROP TABLE IF EXISTS "FigmaOAuthState";
DROP TABLE IF EXISTS "FigmaConnection";

DROP TYPE IF EXISTS "DesignImportKind";
DROP TYPE IF EXISTS "DesignImportStatus";
DROP TYPE IF EXISTS "FigmaConnectionStatus";
DROP TYPE IF EXISTS "FigmaAuthType";
