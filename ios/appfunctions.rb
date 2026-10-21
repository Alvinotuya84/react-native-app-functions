# react-native-app-functions: generates App Intents from appfunctions.config.ts and wires them into
# the iOS app target.
#
# Usage, in ios/Podfile:
#   require_relative '../node_modules/react-native-app-functions/ios/appfunctions'
#   ...
#   post_install do |installer|
#     react_native_post_install(...)
#     appfunctions_post_install(installer)
#   end
#
# Options:
#   target:  name of the app target (default: the project's only application target)
#   config:  path to appfunctions.config.ts, relative to the ios/ directory
#            (default: "../appfunctions.config.ts")
#
# It is idempotent. On every `pod install` it:
#   1. generates <target dir>/AppFunctions.generated.swift (add it to .gitignore),
#   2. adds that file to the target's Compile Sources,
#   3. adds a "Run Script" build phase before Compile Sources that regenerates it on every build.
# To remove it, delete the call, the build phase and the file reference in Xcode.

require 'pathname'
require 'xcodeproj'

APPFUNCTIONS_PHASE_NAME = '[react-native-app-functions] Generate App Intents'.freeze
APPFUNCTIONS_SWIFT_FILE = 'AppFunctions.generated.swift'.freeze

def appfunctions_post_install(installer, target: nil, config: '../appfunctions.config.ts')
  projects = installer.aggregate_targets.map(&:user_project).compact.uniq(&:path)
  project = projects.first or appfunctions_fail('no user Xcode project found')
  app_target = appfunctions_app_target(project, target)

  ios_dir = Pathname.new(project.project_dir)
  lib_dir = Pathname.new(File.expand_path('..', __dir__))
  config_path = ios_dir + config
  source_dir = appfunctions_source_dir(app_target, ios_dir)
  group = project.main_group.find_subpath(app_target.name, false)
  swift_path = source_dir + APPFUNCTIONS_SWIFT_FILE
  cli_path = lib_dir + 'codegen/lib/cli.js'

  # 1. Generate now, so the file exists for Xcode's indexer and the first build.
  appfunctions_fail("config file not found: #{config_path}") unless config_path.file?
  unless cli_path.file?
    appfunctions_fail("codegen not built (#{cli_path} is missing). Run `yarn prepare` in the react-native-app-functions package.")
  end
  unless system('node', cli_path.to_s, '--config', config_path.to_s, '--swift-out', swift_path.to_s)
    appfunctions_fail('generating App Intents failed (see the message above)')
  end

  # 2. Compile the generated file in the app target.
  group ||= project.main_group
  rel_to_group = swift_path.relative_path_from(Pathname.new(group.real_path)).to_s
  ref = group.files.find { |f| f.display_name == APPFUNCTIONS_SWIFT_FILE } || group.new_reference(rel_to_group)
  ref.set_path(rel_to_group) if ref.path != rel_to_group
  ref.name = APPFUNCTIONS_SWIFT_FILE
  unless app_target.source_build_phase.files_references.include?(ref)
    app_target.source_build_phase.add_file_reference(ref, true)
  end

  # 3. Regenerate on every build, before Compile Sources. The CLI only rewrites the file when it
  # changed, so unchanged configs don't trigger recompiles.
  rel = ->(p) { "$SRCROOT/#{p.relative_path_from(ios_dir)}" }
  phase = app_target.shell_script_build_phases.find { |p| p.name == APPFUNCTIONS_PHASE_NAME } ||
          app_target.new_shell_script_build_phase(APPFUNCTIONS_PHASE_NAME)
  phase.shell_script = <<~SH
    # Added by react-native-app-functions (appfunctions_post_install in the Podfile).
    set -e
    if [ -f "$SRCROOT/.xcode.env" ]; then . "$SRCROOT/.xcode.env"; fi
    if [ -f "$SRCROOT/.xcode.env.local" ]; then . "$SRCROOT/.xcode.env.local"; fi
    "${NODE_BINARY:-node}" "#{rel.(cli_path)}" \\
      --config "#{rel.(config_path)}" \\
      --swift-out "#{rel.(swift_path)}" \\
      || { echo "error: react-native-app-functions: generating App Intents failed (see above)"; exit 1; }
  SH
  phase.input_paths = [rel.(config_path).sub('$SRCROOT', '$(SRCROOT)')]
  phase.output_paths = [rel.(swift_path).sub('$SRCROOT', '$(SRCROOT)')]
  phase.shell_path = '/bin/sh'
  phase.always_out_of_date = '1'
  phases = app_target.build_phases
  phases.delete(phase)
  phases.insert(phases.index(app_target.source_build_phase), phase)

  project.save
  Pod::UI.puts "[react-native-app-functions] App Intents: #{swift_path.relative_path_from(ios_dir)} (target #{app_target.name})"
end

def appfunctions_app_target(project, name)
  apps = project.native_targets.select { |t| t.product_type == 'com.apple.product-type.application' }
  if name
    apps.find { |t| t.name == name } or
      appfunctions_fail("no application target named \"#{name}\" (found: #{apps.map(&:name).join(', ')})")
  elsif apps.length == 1
    apps.first
  else
    appfunctions_fail("found #{apps.length} application targets (#{apps.map(&:name).join(', ')}); " \
                      'pass one with appfunctions_post_install(installer, target: "MyApp")')
  end
end

# The directory holding the target's Info.plist (e.g. ios/MyApp/). The RN template's app group has
# no path of its own, so the group can't tell us.
def appfunctions_source_dir(app_target, ios_dir)
  plist = app_target.build_configurations.map { |c| c.build_settings['INFOPLIST_FILE'] }.compact.first
  if plist && !plist.include?('$')
    ios_dir + File.dirname(plist)
  else
    ios_dir + app_target.name
  end
end

def appfunctions_fail(message)
  raise Pod::Informative, "[react-native-app-functions] #{message}"
end
