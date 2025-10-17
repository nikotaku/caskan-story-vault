-- Delete existing pricing options
DELETE FROM pricing_options;

-- Insert correct pricing options from the screenshot
INSERT INTO pricing_options (name, price, description) VALUES
('コース延長30分', 5000, '30分'),
('SNS', 1000, '5分+5分'),
('蛍光', 1000, NULL),
('鼠蹊部', 3000, NULL);