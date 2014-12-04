// list available devices (ideally listen for change in this list and update page if list changes)

// connect to any device that is selected

// once connected get data every 1s? and update widgets/graphs

// disconnect


/* on click of device
    add active class
    get dev id of active or clicked thing
    try a connection
        connectToDevice(devId)
    check that connection was successful
        getConnectedDevice()
    if connected show data
        getSensorData()
    if not connected show message
        device not online hit button to connect
*/


$(document).ready(function() {
  // variables
  const retryTimes = 15
  const connectionRate = 1000
  const refreshDataRate = 1000
  const refreshDevicesRate = 1000
  const agentAddress = "https://agent.electricimp.com/Q55EE8z8iNZE"

  var devices = {}
  var connectionAttempts = retryTimes;


  // look for available devices every 1s
  var sidebarRefresh = window.setInterval(function() { getDevices() }, refreshDevicesRate);

  // listener on sidebar if clicked will attempt a connection
  $(".nav-sidebar").on("click", "li", loadDashboard);


  ////// Page Functions //////
  function loadDashboard(e) {
    e.preventDefault();
    var selected = e.currentTarget;
    var devId = selected.dataset.id;

    $(".active").removeClass("active");
    selected.classList.add("active");
    connectToDevice(devId);
  }

  function isConnected(deviceId) {
    if (deviceId.search(/null/) === -1) {
      connectionAttempts = retryTimes;
      console.log("connected to :");
      console.log(deviceId);
      getData();
    } else if (connectionAttempts > 0) {
      connectionAttempts--;
      setTimeout(function() { getConnectedDevice() }, connectionRate)
    } else {
      connectionAttempts = retryTimes;
      showConnectionFailedMsg()
    }
  }

  function updateActiveDeviceList(activeId) {
    for(device in devices) {
      $(".devices ul").append("<li data-id='" + device + "'><a href='#'>Device Id: " + device + "  RSSI: " + devices[device] + "</a></li>")
      if(activeId) {
        $("li[data-id="+activeId+"]").addClass("active");
      }
    }
  }

  function clearActiveDeviceList() {
    $(".devices ul").html("");
  }

  function getCurrentTime() {
    return (new Date()).toLocaleTimeString()
  }

  function updateCurrentTime(timeDiv) {
    timeDiv.text("Devices Updated at " +getCurrentTime());
  }

  function checkSidebarActive() {
    return ($(".sidebar .active").length > 0) ? $(".sidebar .active").data().id : "";
  }

  function getData() {
    console.log("in get data");
    var dataRefresh = window.setInterval(function() {
      getSensorData();
    }, refreshDataRate)
  }

  function showConnectionFailedMsg() {
    console.log("in connection failed");
    console.log("press button on sensor!!")
  }

  function updateDashboard(data) {
    console.log(data)
  }

  ////// API Ajax requests //////

  //request avialable devices
  function getDevices() {
    $.ajax({
      url : agentAddress + "/listdevs",
      dataType : "json",
      success : function(response) {
        if (JSON.stringify(response) != JSON.stringify(devices)) {
          console.log("updating list");
          var activeId = checkSidebarActive();
          devices = response;
          clearActiveDeviceList();
          updateActiveDeviceList(activeId);
        }
        updateCurrentTime($(".devices .time"));
      }
    });
  }

  //request connected device
  function getConnectedDevice() {
    $.ajax({
      url : agentAddress + "/getconnecteddev",
      success : function(response) {
        isConnected(response)
        //response should look like
        // "207377654321" if device is there
        // "(null :(nil))" if not there
      }
    });
  }


  //connect to a device
  function connectToDevice(devId) {
    $.ajax({
      url : agentAddress + "/connectto",
      type: "post",
      data: devId,
      success : function(response) {
        console.log(response);
        getConnectedDevice();
      }
    });
  }

  //disconnect from a device
  function disconnectFromDevice() {
    $.ajax({
      url : agentAddress + "/disconnect",
      success : function(response) {
        console.log(response);
        //response should look like
        // OK
      }
    });
  }

  //get data from connected device
  function getSensorData() {
    $.ajax({
      url : agentAddress + "/getupdate",
      dataType : "json",
      success : function(response) {
        updateDashboard(response);
        //response should look like
        // { "press": 1002.2, "humid": 22.4, "gyro": [ -104, 476, -462 ], "batt": 21, "temp": 21.6, "accel": [ [ 1, 0, 86 ], [ 1, -1, 87 ], [ 1, -1, 86 ], [ 2, -1, 86 ], [ 2, -1, 86 ], [ 1, 0, 86 ], [ 0, -1, 87 ], [ 2, -1, 86 ], [ 1, -1, 86 ], [ 2, -1, 86 ] ], "mag": [ -554, 903, -2347 ] }
      }
    });
  }

})