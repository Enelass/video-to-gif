#!/usr/bin/env ruby
# video2gif.rb - Convert video files to optimized GIFs using FFmpeg

require 'fileutils'
require 'open3'
require 'json'

class Video2Gif
  VERSION = '1.0.0'
  AUTHOR = 'Florian Bidabe / Photon Security (www.photonsec.com.au)'
  
  def initialize(directory = '.', config_file = 'config.json')
    @directory = directory
    load_config(config_file)
    check_ffmpeg
    puts "\033[1;35m🎬 video2gif-ruby v#{VERSION}\033[0m"
    puts "Developed by #{AUTHOR}"
  end
  
  def load_config(config_file)
    if File.exist?(config_file)
      config = JSON.parse(File.read(config_file))
      
      # Load version settings if available in new format
      if config['versions']
        @version_settings = config['versions']
        # Set medium settings as default for backward compatibility
        medium = @version_settings['medium'] || {}
        @max_width = medium['max_width'] || 1980
        @fps = medium['fps'] || 3
        @color_depth = medium['color_depth'] || 256
        @dither_method = medium['dither_method'] || 'sierra2_4a'
      else
        # Legacy config format
        @max_width = config['max_width'] || 1200
        @fps = config['fps'] || 3
        @color_depth = config['color_depth'] || 256
        @dither_method = config['dither_method'] || 'sierra2_4a'
        
        # Create version settings from legacy format
        @version_settings = {
          'tiny' => {
            'max_width' => 640,
            'fps' => 2,
            'color_depth' => 128,
            'dither_method' => 'bayer'
          },
          'small' => {
            'max_width' => 1280,
            'fps' => 2,
            'color_depth' => 160,
            'dither_method' => 'sierra2_4a'
          },
          'medium' => {
            'max_width' => @max_width,
            'fps' => @fps,
            'color_depth' => @color_depth,
            'dither_method' => @dither_method
          }
        }
      end
      
      @video_extensions = config['supported_video_extensions'] || %w[.mp4 .mkv .avi .mov .wmv .flv .webm .m4v .3gp .mpg .mpeg]
      puts "✅ Loaded configuration from #{config_file}"
    else
      # Default settings if config file doesn't exist
      @max_width = 1980
      @fps = 3
      @color_depth = 256
      @dither_method = 'sierra2_4a'
      @video_extensions = %w[.mp4 .mkv .avi .mov .wmv .flv .webm .m4v .3gp .mpg .mpeg]
      
      # Default version settings
      @version_settings = {
        'tiny' => {
          'max_width' => 640,
          'fps' => 2,
          'color_depth' => 128,
          'dither_method' => 'bayer'
        },
        'small' => {
          'max_width' => 1280,
          'fps' => 2,
          'color_depth' => 160,
          'dither_method' => 'sierra2_4a'
        },
        'medium' => {
          'max_width' => @max_width,
          'fps' => @fps,
          'color_depth' => @color_depth,
          'dither_method' => @dither_method
        }
      }
      
      puts "⚠️ Configuration file not found, using default settings"
    end
  end
  
  
  def check_ffmpeg
    stdout, stderr, status = Open3.capture3('which ffmpeg')
    
    unless status.success?
      puts "❌ Error: FFmpeg is not installed or not in your PATH"
      puts "Please install FFmpeg and try again:"
      puts "  • macOS: brew install ffmpeg"
      puts "  • Ubuntu/Debian: sudo apt install ffmpeg"
      puts "  • Windows: Download from https://ffmpeg.org/download.html"
      exit 1
    end
    
    puts "✅ FFmpeg found: #{stdout.strip}"
  end
  
  def scan_videos
    videos = []
    
    Dir.glob(File.join(@directory, '*')).each do |file|
      next unless File.file?(file)
      
      extension = File.extname(file).downcase
      videos << file if @video_extensions.include?(extension)
    end
    
    if videos.empty?
      puts "❌ No supported video files found in #{@directory}"
      exit 0
    end
    
    puts "🔍 Found #{videos.size} video file(s):"
    videos.each { |v| puts "  • #{File.basename(v)}" }
    
    videos
  end
  
  def get_video_dimensions(video_path)
    cmd = %Q(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "#{video_path}")
    stdout, stderr, status = Open3.capture3(cmd)
    
    if status.success? && stdout.strip =~ /(\d+)x(\d+)/
      width, height = $1.to_i, $2.to_i
      return [width, height]
    else
      puts "⚠️ Warning: Could not determine dimensions for #{File.basename(video_path)}"
      return [0, 0]
    end
  end
  
  def calculate_new_dimensions(width, height)
    return [width, height] if width <= @max_width
    
    new_width = @max_width
    new_height = (height.to_f * (new_width.to_f / width.to_f)).to_i
    
    # Ensure even dimensions (required by some codecs)
    new_width += 1 if new_width % 2 != 0
    new_height += 1 if new_height % 2 != 0
    
    [new_width, new_height]
  end
  
  def convert_to_gif(video_path)
    # Get video dimensions
    width, height = get_video_dimensions(video_path)
    
    puts "\n🎬 Converting #{File.basename(video_path)} to multiple GIF versions..."
    puts "  • Original size: #{width}x#{height}" if width > 0
    
    # Determine medium size based on original width
    medium_max_width = if width > 1980
                         1980
                       elsif width >= 1280
                         width  # Keep original size if between 1280 and 1980
                       else
                         [1280, width].max  # Ensure medium is at least as large as small
                       end
    
    # Create three versions of the GIF using config settings
    versions = [
      {
        name: "tiny",
        max_width: @version_settings['tiny']['max_width'],
        fps: @version_settings['tiny']['fps'],
        color_depth: @version_settings['tiny']['color_depth'],
        dither_method: @version_settings['tiny']['dither_method']
      },
      {
        name: "small",
        max_width: @version_settings['small']['max_width'],
        fps: @version_settings['small']['fps'],
        color_depth: @version_settings['small']['color_depth'],
        dither_method: @version_settings['small']['dither_method']
      },
      {
        name: "medium",
        max_width: medium_max_width,
        fps: @version_settings['medium']['fps'],
        color_depth: @version_settings['medium']['color_depth'],
        dither_method: @version_settings['medium']['dither_method']
      }
    ]
    
    results = []
    
    versions.each do |version|
      output_path = video_path.sub(/\.[^.]+$/, "-#{version[:name]}.gif")
      new_width, new_height = calculate_custom_dimensions(width, height, version[:max_width])
      
      puts "\n  Creating #{version[:name]} version:"
      puts "  • Size: #{new_width}x#{new_height}"
      puts "  • FPS: #{version[:fps]}"
      puts "  • Color depth: #{version[:color_depth]} colors"
      puts "  • Dither method: #{version[:dither_method]}"
      
      # Two-pass approach for better quality and smaller file size
      # 1. Generate palette for better color quantization
      palette_path = "#{File.dirname(video_path)}/palette-#{version[:name]}.png"
      palette_cmd = %Q(ffmpeg -i "#{video_path}" -vf "fps=#{version[:fps]},scale=#{new_width}:#{new_height}:flags=lanczos,palettegen=max_colors=#{version[:color_depth]}" -y "#{palette_path}")
      
      # 2. Use the palette to create the GIF
      gif_cmd = %Q(ffmpeg -i "#{video_path}" -i "#{palette_path}" -lavfi "fps=#{version[:fps]},scale=#{new_width}:#{new_height}:flags=lanczos [x]; [x][1:v] paletteuse=dither=#{version[:dither_method]}" -y "#{output_path}")
      
      # Execute commands
      puts "  • Generating color palette..."
      system(palette_cmd, out: File::NULL)
      
      puts "  • Creating optimized GIF..."
      system(gif_cmd, out: File::NULL)
      
      # Clean up palette file
      FileUtils.rm(palette_path) if File.exist?(palette_path)
      
      if File.exist?(output_path)
        original_size = File.size(video_path)
        gif_size = File.size(output_path)
        size_reduction = ((original_size - gif_size) / original_size.to_f * 100).round(2)
        
        puts "  ✅ #{version[:name]} version complete!"
        puts "    • Size: #{format_size(gif_size)} (#{size_reduction}% reduction)"
        puts "    • Saved to: #{output_path}"
        
        results << {
          "version" => version[:name],
          "path" => output_path,
          "size" => gif_size,
          "dimensions" => "#{new_width}x#{new_height}",
          "reduction" => size_reduction
        }
      else
        puts "  ❌ Failed to create #{version[:name]} version"
      end
    end
    
    # Return results as a hash
    result_hash = {
      "original" => {
        "path" => video_path,
        "size" => File.size(video_path),
        "dimensions" => "#{width}x#{height}"
      },
      "versions" => results
    }
    
    return result_hash
  end
  
  def calculate_custom_dimensions(width, height, max_width)
    return [width, height] if width <= max_width
    
    new_width = max_width
    new_height = (height.to_f * (new_width.to_f / width.to_f)).to_i
    
    # Ensure even dimensions (required by some codecs)
    new_width += 1 if new_width % 2 != 0
    new_height += 1 if new_height % 2 != 0
    
    [new_width, new_height]
  end
  
  def format_size(size_in_bytes)
    units = ['B', 'KB', 'MB', 'GB']
    unit_index = 0
    size = size_in_bytes.to_f
    
    while size >= 1024 && unit_index < units.length - 1
      size /= 1024
      unit_index += 1
    end
    
    "#{size.round(2)} #{units[unit_index]}"
  end
  
  def process_all
    puts "Converting videos to optimized GIFs..."
    
    results = []
    
    # If a specific file is provided as an argument, only convert that file
    if ARGV.length > 0 && File.exist?(ARGV[0])
      results << convert_to_gif(ARGV[0])
      puts "\n🎉 Conversion completed!"
    else
      videos = scan_videos
      videos.each do |video|
        results << convert_to_gif(video)
      end
      
      puts "\n🎉 All conversions completed!"
    end
    
    # Print comparison table
    puts "\n📊 Size Comparison:"
    results.each_with_index do |result, index|
      original_size = result["original"]["size"]
      puts "Video #{index + 1}: #{File.basename(result["original"]["path"])}"
      puts "  • Original: #{format_size(original_size)} (#{result["original"]["dimensions"]})"
      
      result["versions"].each do |version|
        puts "  • #{version["version"].capitalize}: #{format_size(version["size"])} (#{version["dimensions"]}) - #{version["reduction"]}% reduction"
      end
      puts ""
    end
    
    return results
  end
end

# Run the script only if this file is executed directly (not required/imported)
if __FILE__ == $PROGRAM_NAME
  Video2Gif.new.process_all
end
