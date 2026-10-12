require 'json'
require 'rubygems'
begin
  data = JSON.parse(STDIN.read)
  requirements = data.fetch('range').split(',').map(&:strip)
  requirement = Gem::Requirement.new(*requirements)
  matches = requirement.satisfied_by?(Gem::Version.new(data.fetch('version')))
  puts JSON.generate({'matches' => matches, 'issues' => []})
rescue ArgumentError, KeyError, TypeError, JSON::ParserError => error
  puts JSON.generate({'matches' => false, 'issues' => [{'code' => 'INVALID_RANGE', 'action' => error.message}]})
  exit 1
end
