param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

function Fail([string]$Message) {
    [Console]::Out.WriteLine("ERR $Message")
    exit 3
}

function Role($Element) {
    $type = $Element.Current.ControlType
    if ($type -eq [System.Windows.Automation.ControlType]::Button) { return 'AXButton' }
    if ($type -eq [System.Windows.Automation.ControlType]::Edit) { return 'AXTextArea' }
    if ($type -eq [System.Windows.Automation.ControlType]::Text) { return 'AXStaticText' }
    if ($type -eq [System.Windows.Automation.ControlType]::Menu) { return 'AXMenu' }
    if ($type -eq [System.Windows.Automation.ControlType]::MenuItem) { return 'AXMenuItem' }
    if ($type -eq [System.Windows.Automation.ControlType]::Slider) { return 'AXSlider' }
    if ($type -eq [System.Windows.Automation.ControlType]::CheckBox) { return 'AXCheckBox' }
    if ($type -eq [System.Windows.Automation.ControlType]::ComboBox) { return 'AXComboBox' }
    if ($type -eq [System.Windows.Automation.ControlType]::Window) { return 'AXWindow' }
    return 'AXGroup'
}

function Supports($Element, $Pattern) {
    $value = $null
    return $Element.TryGetCurrentPattern($Pattern, [ref]$value)
}

function Matches($Element, [string]$WantedRole, [string]$Query) {
    $role = Role $Element
    if ($WantedRole -eq 'AXPopUpButton') {
        if ($role -ne 'AXButton' -and $role -ne 'AXComboBox') { return $false }
    } elseif ($WantedRole -eq 'AXTextField') {
        if ($role -ne 'AXTextArea') { return $false }
    } elseif ($WantedRole -ne $role) { return $false }
    $name = $Element.Current.Name
    $help = $Element.Current.HelpText
    if (-not $Query) { return $true }
    if ($Query.StartsWith('=')) { return ($name -eq $Query.Substring(1) -or $help -eq $Query.Substring(1)) }
    return ($name.IndexOf($Query, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or $help.IndexOf($Query, [StringComparison]::OrdinalIgnoreCase) -ge 0)
}

function Nodes($Root) {
    $Root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)
}

function Label($Element) {
    $name = $Element.Current.Name
    $help = $Element.Current.HelpText
    $disabled = if ($Element.Current.IsEnabled) { '' } else { ' [disabled]' }
    return "$name | $help | $disabled"
}

try {
    $command = if ($Arguments.Count) { $Arguments[0] } else { 'dump' }
    if ($command -notin @('dump', 'count', 'find', 'attrs', 'textlen')) {
        Fail 'unsupported-command: Windows helper is read-only'
    }
    $processes = @(Get-Process -Name ZCode -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero })
    if ($processes.Count -eq 0) { Fail 'zcode-not-running' }
    if ($processes.Count -ne 1) { Fail 'ambiguous-window' }
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($processes[0].MainWindowHandle)
    if (-not $root) { Fail 'no-window' }
    $elements = Nodes $root
    if ($command -eq 'dump') {
        foreach ($element in $elements) {
            $role = Role $element
            $name = $element.Current.Name.Replace('"', '\"').Replace("`n", '\n')
            $help = $element.Current.HelpText.Replace('"', '\"').Replace("`n", '\n')
            $line = $role
            if ($name) { $line += " t=`"$name`"" }
            if ($help) { $line += " d=`"$help`"" }
            [Console]::Out.WriteLine($line)
        }
        exit 0
    }
    if ($Arguments.Count -lt 3) { Fail 'usage' }
    $selected = @($elements | Where-Object { Matches $_ $Arguments[1] $Arguments[2] })
    if ($command -eq 'count') { [Console]::Out.WriteLine($selected.Count); exit 0 }
    if ($command -eq 'find') {
        foreach ($element in $selected) { [Console]::Out.WriteLine((Label $element)) }
        exit 0
    }
    $index = 0
    if ($env:ZCAX_NTH -and -not [int]::TryParse($env:ZCAX_NTH, [ref]$index)) { Fail 'invalid-index' }
    if ($index -lt 0 -or $index -ge $selected.Count) { Fail 'not-found' }
    $element = $selected[$index]
    if ($command -eq 'attrs') {
        $range = $null
        $value = ''
        if ($element.TryGetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern, [ref]$range)) { $value = $range.Current.Value }
        [Console]::Out.WriteLine("value=$value enabled=$($element.Current.IsEnabled)")
        exit 0
    }
    if ($command -eq 'textlen') {
        $pattern = $null
        if (-not $element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { Fail 'value-unavailable' }
        [Console]::Out.WriteLine("OK len=$($pattern.Current.Value.Length)")
        exit 0
    }
} catch {
    Fail ('automation-error: ' + $_.Exception.Message)
}
